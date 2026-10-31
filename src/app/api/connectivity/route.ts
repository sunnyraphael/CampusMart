export function GET() {
  return Response.json({ online: true }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
