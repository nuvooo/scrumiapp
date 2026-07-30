export interface VoteStats {
  /** Durchschnitt der numerischen Votes, auf eine Nachkommastelle gerundet (null = keine). */
  average: number | null;
  /** Median der numerischen Votes (bei gerader Anzahl Mittel der beiden mittleren). */
  median: number | null;
  /** Anzahl numerischer Votes — „?“ (null) zählt nicht. */
  count: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Statistik über die abgegebenen Poker-Votes; „?“-Votes (null) bleiben außen vor. */
export function calcVoteStats(votes: (number | null)[]): VoteStats {
  const nums = votes.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (nums.length === 0) return { average: null, median: null, count: 0 };

  const average = round1(nums.reduce((a, b) => a + b, 0) / nums.length);
  const mid = Math.floor(nums.length / 2);
  const median =
    nums.length % 2 === 1 ? nums[mid] : round1((nums[mid - 1] + nums[mid]) / 2);
  return { average, median, count: nums.length };
}
