import fs from "node:fs";
import path from "node:path";

const TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.GITHUB_USERNAME || "Sourav-IIITBPL";

if (!TOKEN) {
  throw new Error("GITHUB_TOKEN is not configured.");
}

const END = new Date();
const START = new Date(END);
START.setFullYear(START.getFullYear() - 1);

const from = START.toISOString();
const to = END.toISOString();

async function graphql(query, variables = {}) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "github-stats-generator",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

  if (!response.ok || json.errors) {
    console.error(JSON.stringify(json, null, 2));
    throw new Error("GitHub GraphQL request failed.");
  }

  return json.data;
}

const query = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalIssueContributions
      totalPullRequestContributions
      totalCommitContributions

      totalRepositoriesWithContributedCommits
      totalRepositoriesWithContributedIssues
      totalRepositoriesWithContributedPullRequests

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
          nameWithOwner
          primaryLanguage {
            name
          }
        }
      }

      issueContributionsByRepository(maxRepositories: 100) {
        repository {
          nameWithOwner
          primaryLanguage {
            name
          }
        }
      }

      pullRequestContributionsByRepository(maxRepositories: 100) {
        repository {
          nameWithOwner
          primaryLanguage {
            name
          }
        }
      }
    }

    repositories(
      first: 100
      ownerAffiliations: OWNER
      privacy: PUBLIC
    ) {
      nodes {
        nameWithOwner
        primaryLanguage {
          name
        }
        languages(first: 20, orderBy: {field: SIZE, direction: DESC}) {
          edges {
            size
            node {
              name
            }
          }
        }
      }
    }
  }
}
`;

const data = await graphql(query, {
  login: USERNAME,
  from,
  to,
});

const user = data.user;
const contributions = user.contributionsCollection;

/*
 * ---------------------------------------------------------
 * REPOSITORIES
 * ---------------------------------------------------------
 *
 * Count repositories where the user contributed through:
 * - commits
 * - issues
 * - pull requests
 *
 * This avoids counting repositories with unrelated activity.
 */

const repositoryNames = new Set();

for (const group of [
  contributions.commitContributionsByRepository,
  contributions.issueContributionsByRepository,
  contributions.pullRequestContributionsByRepository,
]) {
  for (const item of group) {
    if (item.repository?.nameWithOwner) {
      repositoryNames.add(item.repository.nameWithOwner);
    }
  }
}

const repositoriesContributed = repositoryNames.size;

/*
 * ---------------------------------------------------------
 * ISSUES / PRs
 * ---------------------------------------------------------
 */

const issues = contributions.totalIssueContributions;
const pullRequests = contributions.totalPullRequestContributions;

/*
 * ---------------------------------------------------------
 * LANGUAGES
 * ---------------------------------------------------------
 *
 * Count meaningful languages from repositories accessible
 * to the token, then show the top 9 by code volume.
 */

const languageBytes = new Map();

for (const repo of user.repositories.nodes || []) {
  for (const edge of repo.languages?.edges || []) {
    const language = edge.node?.name;
    const size = edge.size || 0;

    if (!language) continue;

    languageBytes.set(
      language,
      (languageBytes.get(language) || 0) + size
    );
  }
}

const languages = [...languageBytes.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 9);

const languageCount = languages.length;

/*
 * ---------------------------------------------------------
 * STREAK
 * ---------------------------------------------------------
 */

const days = [];

for (const week of contributions.contributionCalendar.weeks) {
  for (const day of week.contributionDays) {
    days.push({
      date: day.date,
      count: day.contributionCount,
    });
  }
}

days.sort((a, b) => a.date.localeCompare(b.date));

let currentStreak = 0;
let longestStreak = 0;
let runningStreak = 0;

for (const day of days) {
  if (day.count > 0) {
    runningStreak++;
    longestStreak = Math.max(longestStreak, runningStreak);
  } else {
    runningStreak = 0;
  }
}

for (let i = days.length - 1; i >= 0; i--) {
  if (days[i].count > 0) {
    currentStreak++;
  } else {
    break;
  }
}

/*
 * ---------------------------------------------------------
 * DATE LABEL
 * ---------------------------------------------------------
 */

const formatDate = (date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

const periodLabel = `${formatDate(START)} – ${formatDate(END)}`;

/*
 * ---------------------------------------------------------
 * SVG HELPERS
 * ---------------------------------------------------------
 */

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function snapshotSvg() {
  const cards = [
    {
      icon: "📦",
      value: repositoriesContributed,
      label: "Repositories",
    },
    {
      icon: "💬",
      value: issues,
      label: "Issues",
    },
    {
      icon: "🔀",
      value: pullRequests,
      label: "Pull Requests",
    },
    {
      icon: "💻",
      value: languageCount,
      label: "Languages",
    },
  ];

  const cardWidth = 220;
  const gap = 20;
  const startX = 20;

  return `
<svg width="980" height="175" viewBox="0 0 980 175"
     xmlns="http://www.w3.org/2000/svg">

  <rect width="980" height="175" rx="14" fill="#0d1117"/>

  ${cards
    .map((card, index) => {
      const x = startX + index * (cardWidth + gap);

      return `
      <g>
        <rect
          x="${x}"
          y="18"
          width="${cardWidth}"
          height="112"
          rx="12"
          fill="#161b22"
          stroke="#30363d"
        />

        <text
          x="${x + 18}"
          y="50"
          font-size="20"
          font-family="Arial, sans-serif"
        >${card.icon}</text>

        <text
          x="${x + 18}"
          y="88"
          fill="#f0f6fc"
          font-size="30"
          font-weight="700"
          font-family="Arial, sans-serif"
        >${escapeXml(card.value)}</text>

        <text
          x="${x + 18}"
          y="112"
          fill="#8b949e"
          font-size="13"
          font-family="Arial, sans-serif"
        >${escapeXml(card.label)}</text>
      </g>
      `;
    })
    .join("")}

  <text
    x="490"
    y="155"
    text-anchor="middle"
    fill="#8b949e"
    font-size="12"
    font-family="Arial, sans-serif"
  >
    ${escapeXml(periodLabel)}
  </text>

</svg>
`;
}

function activitySvg() {
  return `
<svg width="780" height="125" viewBox="0 0 780 125"
     xmlns="http://www.w3.org/2000/svg">

  <rect width="780" height="125" rx="14" fill="#0d1117"/>

  <rect
    x="20"
    y="18"
    width="360"
    height="68"
    rx="12"
    fill="#161b22"
    stroke="#30363d"
  />

  <rect
    x="400"
    y="18"
    width="360"
    height="68"
    rx="12"
    fill="#161b22"
    stroke="#30363d"
  />

  <text
    x="42"
    y="47"
    fill="#8b949e"
    font-size="13"
    font-family="Arial, sans-serif"
  >
    🔥 Current Streak
  </text>

  <text
    x="42"
    y="73"
    fill="#f0f6fc"
    font-size="22"
    font-weight="700"
    font-family="Arial, sans-serif"
  >
    ${currentStreak} days
  </text>

  <text
    x="422"
    y="47"
    fill="#8b949e"
    font-size="13"
    font-family="Arial, sans-serif"
  >
    ⚡ Longest Streak
  </text>

  <text
    x="422"
    y="73"
    fill="#f0f6fc"
    font-size="22"
    font-weight="700"
    font-family="Arial, sans-serif"
  >
    ${longestStreak} days
  </text>

  <text
    x="390"
    y="108"
    text-anchor="middle"
    fill="#8b949e"
    font-size="12"
    font-family="Arial, sans-serif"
  >
    Contribution activity · ${escapeXml(periodLabel)}
  </text>

</svg>
`;
}

/*
 * ---------------------------------------------------------
 * WRITE FILES
 * ---------------------------------------------------------
 */

const assetsDir = path.join(process.cwd(), "assets");

fs.mkdirSync(assetsDir, { recursive: true });

fs.writeFileSync(
  path.join(assetsDir, "github-snapshot.svg"),
  snapshotSvg()
);

fs.writeFileSync(
  path.join(assetsDir, "github-activity.svg"),
  activitySvg()
);

/*
 * ---------------------------------------------------------
 * LOG
 * ---------------------------------------------------------
 */

console.log("GitHub stats generated successfully.");
console.log("-----------------------------------");
console.log(`Repositories: ${repositoriesContributed}`);
console.log(`Issues:       ${issues}`);
console.log(`Pull Requests:${pullRequests}`);
console.log(`Languages:    ${languageCount}`);
console.log(`Current:      ${currentStreak} days`);
console.log(`Longest:      ${longestStreak} days`);
console.log(`Period:       ${periodLabel}`);