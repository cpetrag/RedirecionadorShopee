export type ClickStats = {
  total: number;
  real: number;
  bots: number;
  by_platform: Record<string, number>;
  in_app: number;
};

export type ParsedSubId = {
  slot: number;
  value: string;
};

export type LinkRow = {
  id: number;
  slug: string;
  shopee_url: string;
  sub_id: string | null;
  sub_ids: ParsedSubId[];
  title: string | null;
  active: number;
  created_at: string;
  redirect_url: string;
  clicks: ClickStats;
};

export type DayStat = {
  date: string;
  real: number;
  bots: number;
  in_app: number;
};

export type HourStat = {
  hour: number;
  real: number;
  bots: number;
  in_app: number;
};

export type PlatformPeriodStat = {
  platform: string;
  real: number;
  bots: number;
  in_app: number;
};

export type ReportData = {
  days: number;
  link_id: number | null;
  summary: ClickStats & { links_count?: number; active_links?: number };
  by_day: DayStat[];
  by_hour: HourStat[];
  by_platform_period: PlatformPeriodStat[];
  links: LinkRow[];
};
