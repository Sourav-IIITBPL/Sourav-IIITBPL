const fs = require("fs");
const path = require("path");

const TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.GITHUB_USERNAME || "Sourav-IIITBPL";

if (!TOKEN) {
  throw new Error("GITHUB_TOKEN is required.");
}

const GRAPHQL_URL = "https://api.github.com/graphql";

async function githubGraphQL(query, variables = {}) {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(
      `GitHub GraphQL error: ${JSON.stringify(result.errors, null, 2)}`
    );
  }

  return result.data;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function ensureAssetsDirectory() {
  const assetsDir = path.join(process.cwd(), "assets");

  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  return assetsDir;
}

function generateSnapshotSvg(stats) {
  const width = 960;
  const height = 150;

  const cards = [
    {
      icon: "📦",
      value: stats.repositories,
      label: "Repositories",
      sublabel: "contributed to",
    },
    {
      icon: "💬",
      value: stats.issues,
      label: "Issues",
      sublabel: "opened",
    },
    {
      icon: "🔀",
      value: stats.pullRequests,
      label: "Pull Requests",
      sublabel: "opened",
    },
    {
      icon: "💻",
      value: stats.languages,
      label: "Languages",
      sublabel: "used",
    },
  ];

  const gap = 16;
  const cardWidth = (width - gap * 3) / 4;

  const cardMarkup = cards
    .map((card, index) => {
      const x = index * (cardWidth + gap);

      return `
        <g transform="translate(${x}, 0)">
          <rect
            x="0"
            y="0"
            width="${cardWidth}"
            height="132"
            rx="14"
            fill="#111827"
            stroke="#30363d"
            stroke-width="1"
          />

          <text
            x="24"
            y="35"
            font-family="Arial, Helvetica, sans-serif"
            font-size="19"
            fill="#8b949e"
          >${escapeXml(card.icon)}</text>

          <text
            x="24"
            y="77"
            font-family="Arial, Helvetica, sans-serif"
            font-size="30"
            font-weight="700"
            fill="#f0f6fc"
          >${escapeXml(card.value)}</text>

          <text
            x="24"
            y="101"
            font-family="Arial, Helvetica, sans-serif"
            font-size="14"
            font-weight="600"
            fill="#c9d1d9"
          >${escapeXml(card.label)}</text>

          <text
            x="24"
            y="120"
            font-family="Arial, Helvetica, sans-serif"
            font-size="12"
            fill="#8b949e"
          >${escapeXml(card.sublabel)}</text>
        </g>
      `;
    })
    .join("");

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  role="img"
  aria-label="GitHub contribution snapshot"
>
  <rect
    width="${width}"
    height="${height}"
    rx="16"
    fill="#0d1117"
  />

  <g transform="translate(0, 9)">
    ${cardMarkup}
  </g>
</svg>
`.trim();
}

function generateActivitySvg(currentStreak, longestStreak) {
  const width = 700;
  const height = 95;

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  role="img"
  aria-label="GitHub activity streak"
>
  <rect
    width="${width}"
    height="${height}"
    rx="16"
    fill="#0d1117"
    stroke="#30363d"
    stroke-width="1"
  />

  <text
    x="32"
    y="39"
    font-family="Arial, Helvetica, sans-serif"
    font-size="16"
    fill="#f0f6fc"
  >🔥</text>

  <text
    x="58"
    y="39"
    font-family="Arial, Helvetica, sans-serif"
    font-size="15"
    font-weight="600"
    fill="#c9d1d9"
  >Current Streak</text>

  <text
    x="180"
    y="39"
    font-family="Arial, Helvetica, sans-serif"
    font-size="17"
    font-weight="700"
    fill="#f0f6fc"
  >${escapeXml(currentStreak)} days</text>

  <line
    x1="350"
    y1="22"
    x2="350"
    y2="58"
    stroke="#30363d"
  />

  <text
    x="382"
    y="39"
    font-family="Arial, Helvetica, sans-serif"
    font-size="16"
    fill="#f0f6fc"
  >⚡</text>

  <text
    x="408"
    y="39"
    font-family="Arial, Helvetica, sans-serif"
    font-size="15"
    font-weight="600"
    fill="#c9d1d9"
  >Longest Streak</text>

  <text
    x="545"
    y="39"
    font-family="Arial, Helvetica, sans-serif"
    font-size="17"
    font-weight="700"
    fill="#f0f6fc"
  >${escapeXml(longestStreak)} days</text>

  <text
    x="32"
    y="69"
    font-family="Arial, Helvetica, sans-serif"
    font-size="11"
    fill="#8b949e"
  >Updated automatically from GitHub</text>
</svg>
`.trim();
}

function calculateStreak(contributionCalendar) {
  const days = contributionCalendar.weeks
    .flatMap((week) => week.contributionDays)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!days.length) {
    return {
      current: 0,
      longest: 0,
    };
  }

  let longest = 0;
  let running = 0;

  for (const day of days) {
    if (day.contributionCount > 0) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  let current = 0;

  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (days[i].contributionCount > 0) {
      current += 1;
    } else {
      break;
    }
  }

  return {
    current,
    longest,
  };
}

async function main() {
  console.log(`Fetching GitHub statistics for ${USERNAME}...`);

  const query = `
    query($login: String!) {
      user(login: $login) {
        login

        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }

          commitContributionsByRepository(maxRepositories: 100) {
            repository {
              name
            }
          }

          issueContributionsByRepository(maxRepositories: 100) {
            repository {
              name
            }
          }

          pullRequestContributionsByRepository(maxRepositories: 100) {
            repository {
              name
            }
          }
        }

        repositories(
          first: 100
          ownerAffiliations: OWNER
          privacy: PUBLIC
        ) {
          nodes {
            name
            primaryLanguage {
              name
            }
            languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
              nodes {
                name
              }
            }
          }
        }
      }
    }
  `;

  const data = await githubGraphQL(query, {
    login: USERNAME,
  });

  const user = data.user;

  if (!user) {
    throw new Error(`GitHub user "${USERNAME}" was not found.`);
  }

  const contributions = user.contributionsCollection;

  /*
   * Count unique repositories where you have made
   * commit, issue, or pull-request contributions.
   */
  const contributedRepositories = new Set();

  for (const item of contributions.commitContributionsByRepository) {
    contributedRepositories.add(item.repository.name);
  }

  for (const item of contributions.issueContributionsByRepository) {
    contributedRepositories.add(item.repository.name);
  }

  for (const item of contributions.pullRequestContributionsByRepository) {
    contributedRepositories.add(item.repository.name);
  }

  /*
   * GitHub's contribution connections represent contributions
   * during the selected contribution period.
   *
   * For this profile, that gives us the active contribution
   * repository count used in the Snapshot.
   */
  const repositories = contributedRepositories.size;

  /*
   * Count authored issues and pull requests.
   *
   * The contribution groups tell us which repositories contain
   * those contributions, but not the total authored item count.
   *
   * We therefore use GitHub's search API for the exact totals.
   */
  async function githubSearch(query) {
    const response = await fetch(
      `https://api.github.com/search/issues?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `GitHub search failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  const [issuesResult, pullRequestsResult] = await Promise.all([
    githubSearch(`author:${USERNAME} type:issue`),
    githubSearch(`author:${USERNAME} type:pr`),
  ]);

  const issues = issuesResult.total_count;
  const pullRequests = pullRequestsResult.total_count;

  /*
   * Count unique languages across public repositories.
   *
   * We intentionally ignore null/empty languages.
   */
  const languages = new Set();

  for (const repository of user.repositories.nodes) {
    if (repository.primaryLanguage?.name) {
      languages.add(repository.primaryLanguage.name);
    }

    for (const language of repository.languages.nodes) {
      if (language.name) {
        languages.add(language.name);
      }
    }
  }

  const languageCount = languages.size;

  const streak = calculateStreak(contributions.contributionCalendar);

  const stats = {
    repositories,
    issues,
    pullRequests,
    languages: languageCount,
  };

  console.log("GitHub Snapshot:");
  console.log(stats);

  console.log("GitHub Activity:");
  console.log({
    currentStreak: streak.current,
    longestStreak: streak.longest,
  });

  const assetsDir = ensureAssetsDirectory();

  const snapshotSvg = generateSnapshotSvg(stats);

  const activitySvg = generateActivitySvg(
    streak.current,
    streak.longest
  );

  fs.writeFileSync(
    path.join(assetsDir, "github-snapshot.svg"),
    snapshotSvg,
    "utf8"
  );

  fs.writeFileSync(
    path.join(assetsDir, "github-activity.svg"),
    activitySvg,
    "utf8"
  );

  console.log("Generated:");
  console.log("  assets/github-snapshot.svg");
  console.log("  assets/github-activity.svg");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});