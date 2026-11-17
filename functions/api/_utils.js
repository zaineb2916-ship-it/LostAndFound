
const COOKIE = "laf_session";
const ITERATIONS = 100000;
const enc = new TextEncoder();

const b64 = (bytes) =>
  btoa(
    String.fromCharCode(...new Uint8Array(bytes))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const unb64 = (value) => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(value) ||
    value.length % 4 === 1
  ) {
    throw new Error("Invalid Base64 data");
  }

  const standard = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = standard + "=".repeat(
    (4 - standard.length % 4) % 4
  );

  return Uint8Array.from(
    atob(padded),
    c => c.charCodeAt(0)
  );
};

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

export function fail(message, status = 400) {
  return json({ error: message }, status);
}

export async function body(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function cookie(request) {
  return (request.headers.get("Cookie") || "")
    .split(";")
    .map(x => x.trim())
    .find(x => x.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1) || null;
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(data)
    )
  );
}

export async function makeSession(user, secret) {
  const payload = b64(
    enc.encode(
      JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
      })
    )
  );

  const signature = await hmac(secret, payload);

  return payload + "." + b64(signature);
}

export async function getUser(request, env) {
  try {
    const token = cookie(request);

    if (
      !token ||
      !env.SESSION_SECRET ||
      token.length > 4096
    ) {
      return null;
    }

    const parts = token.split(".");

    if (parts.length !== 2) return null;

    const [payload, signature] = parts;

    if (!payload || !signature) return null;

    const actual = unb64(signature);

    if (actual.length !== 32) return null;

    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(env.SESSION_SECRET),
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      actual,
      enc.encode(payload)
    );

    if (!valid) return null;

    const decoded = new TextDecoder().decode(
      unb64(payload)
    );

    const user = JSON.parse(decoded);

    if (
      !user ||
      typeof user !== "object" ||
      !user.id ||
      typeof user.name !== "string" ||
      typeof user.email !== "string" ||
      !Number.isFinite(user.exp) ||
      user.exp <= Date.now()
    ) {
      return null;
    }

    return user;

  } catch (error) {
    console.error("GET USER ERROR:", error.message);
    return null;
  }
}

export function sessionCookie(token) {
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`;
}

export function clearCookie() {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    throw new Error("Invalid password length");
  }

  try {
    const salt = crypto.getRandomValues(
      new Uint8Array(16)
    );

    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: ITERATIONS,
        hash: "SHA-256"
      },
      key,
      256
    );

    return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(bits)}`;

  } catch (error) {
    console.error("HASH PASSWORD ERROR:", error.message);
    throw error;
  }
}

export async function verifyPassword(password, stored) {
  try {
    if (
      typeof password !== "string" ||
      typeof stored !== "string"
    ) {
      return false;
    }

    const parts = stored.split("$");

    if (parts.length !== 4) return false;

    const [scheme, iterationText, saltText, hashText] = parts;

    const iterations = Number(iterationText);

    if (
      scheme !== "pbkdf2" ||
      !Number.isInteger(iterations) ||
      iterations < 10000 ||
      iterations > ITERATIONS
    ) {
      return false;
    }

    const salt = unb64(saltText);
    const expectedHash = unb64(hashText);

    if (
      salt.length !== 16 ||
      expectedHash.length !== 32
    ) {
      return false;
    }

    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    const bits = new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt,
          iterations,
          hash: "SHA-256"
        },
        key,
        256
      )
    );

    const actualHash = b64(bits);
    const expectedText = b64(expectedHash);

    if (actualHash.length !== expectedText.length) {
      return false;
    }

    let difference = 0;

    for (let i = 0; i < actualHash.length; i++) {
      difference |=
        actualHash.charCodeAt(i) ^
        expectedText.charCodeAt(i);
    }

    return difference === 0;

  } catch (error) {
    console.error("VERIFY PASSWORD ERROR:", error.message);
    return false;
  }
}

export const requiredSecret = (env) =>
  typeof env?.SESSION_SECRET === "string" &&
  env.SESSION_SECRET.length >= 32;
