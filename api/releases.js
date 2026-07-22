/**
 * /api/releases  — proxies GitHub Releases API for a private repo.
 *
 * Query params:
 *   ?type=latest   → GET /releases/latest  (default)
 *   ?type=all      → GET /releases?per_page=15
 *
 * Requires env var GITHUB_TOKEN (read-only, "Contents: read" scope).
 * Add it in: Vercel Dashboard → Project → Settings → Environment Variables.
 */

const REPO = 'JuanAntonioZ369/RetroGamingRevs_2.0';
const BASE  = 'https://api.github.com/repos/' + REPO + '/releases';

export default async function handler(req, res) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
  }

  const type    = req.query.type === 'all' ? 'all' : 'latest';
  const ghUrl   = type === 'all' ? BASE + '?per_page=15' : BASE + '/latest';

  try {
    const ghRes = await fetch(ghUrl, {
      headers: {
        Authorization: 'token ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'revsgaming-site/1.0'
      }
    });

    if (!ghRes.ok) {
      return res.status(ghRes.status).json({ error: 'GitHub API error', status: ghRes.status });
    }

    const data = await ghRes.json();

    // Cache: 5 minutes on CDN, stale-while-revalidate 60 min
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}
