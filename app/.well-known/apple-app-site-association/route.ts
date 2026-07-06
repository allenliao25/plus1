export const dynamic = "force-static";

const AASA = {
  applinks: {
    apps: [],
    details: [
      {
        appIDs: ["PNQXU683AK.com.allenliao.Plus1"],
        components: [
          {
            "/": "/e/*",
            comment: "event share links open in the plus1 app",
          },
        ],
      },
    ],
  },
};

export async function GET() {
  return new Response(JSON.stringify(AASA), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
}
