export const TODAY_PAGE_SIZE = 20;

export type TodayBadge = 'none' | 'started' | 'reassigned' | 'amendment';

export type TodayRow = {
  key: string;
  sourceId: string;
  number: string;
  kind?: string;
  priority: string;
  status: string;
  summary: string;
  siteName: string;
  startDt: number;
  endDt?: number;
  openId: string;
  openCollection: 'workordersin' | 'workordersout';
  badge: TodayBadge;
  role?: string;
};

export type InboundHit = {
  id: string;
  number: string;
  kind?: string;
  priority: string;
  status: string;
  summary: string;
  siteName: string;
  startDt: number;
  endDt?: number;
  assignedEmployeeId: string;
};

export type OutboundHit = {
  id: string;
  sourceId: string;
  number: string;
  kind?: string;
  priority: string;
  status: string;
  summary: string;
  siteName: string;
  startDt: number;
  endDt?: number;
  role: string;
  assignedEmployeeId: string;
  dropped?: boolean;
};

export type OutboundRef = {
  id: string;
  sourceId: string;
  status: string;
  role: string;
  auditCrDt?: number;
};
