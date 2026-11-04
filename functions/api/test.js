export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      success: true,
      message: "API is working"
    }),
    {
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
