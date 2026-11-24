export async function GET() {
  return Response.json({
    ok: true,
    service: "hisham-academy",
    time: new Date().toISOString(),
  });
}
