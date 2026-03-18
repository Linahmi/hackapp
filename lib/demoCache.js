// lib/demoCache.js
import { getData } from './dataLoader.js';

export function getDemoRequests() {
  try {
    const data = getData();
    const requests = data.requests || [];

    const req4 = requests.find(r => r.request_id === 'REQ-000004');
    const reqStandard = requests.find(r => 
      r.scenario_tags && 
      r.scenario_tags.includes('standard') && 
      r.request_id !== 'REQ-000004'
    );
    
    const results = [];
    if (req4) results.push(req4);
    if (reqStandard) results.push(reqStandard);

    return results.map(r => ({
      request_id: r.request_id,
      title: r.title || 'Untitled Request',
      description: r.title || 'No description provided.',
      tags: r.scenario_tags || [],
      request_text: r.request_text || ''
    }));
  } catch (error) {
    return [];
  }
}
