import client from './client';

interface SiteInfo {
  icp_number: string;
  public_security_number: string;
}

export const siteApi = {
  /** Get site info (ICP number, public security number). No auth required. */
  getInfo: async (): Promise<SiteInfo> => {
    const { data } = await client.get('/api/site/info');
    return data;
  },
};
