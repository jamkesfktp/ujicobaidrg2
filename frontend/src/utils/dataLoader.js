// src/utils/dataLoader.js

const cache = {};
// Use a fixed timestamp for the current session to bypass old browser caches,
// but keep the same URL during the session so the browser can cache it if needed.
const SESSION_VERSION = Date.now(); 

export const loadDatasetFile = async (dataset, fileType, month = 'all', drgType = 'all') => {
  const is1370 = dataset.includes('1370');
  const d3DrgType = is1370 ? '1370' : '1363';
  
  let normalizedDataset = dataset;
  if (dataset.startsWith('dataset4')) normalizedDataset = is1370 ? 'jan_des_v11_1370' : 'jan_des_v11_1363';
  if (dataset.startsWith('dataset3')) normalizedDataset = is1370 ? 'okt_jun_v3_1370' : 'okt_jun_v3_1363';

  const key = `${normalizedDataset}_${fileType}_${month}_${d3DrgType}`;
  
  if (cache[key]) {
    return cache[key];
  }
  
  const getUrl = (ft) => {
    if (ft.startsWith('hospitals/')) {
      return `/data/${ft}.json?v=${SESSION_VERSION}`;
    }
    return `/data/${normalizedDataset}_${ft}.json?v=${SESSION_VERSION}`;
  };

  const fetchUrl = getUrl(fileType);
  
  let promise = fetch(fetchUrl).then(res => {
    if (!res.ok) throw new Error(`Failed to load ${fileType} from ${fetchUrl}`);
    return res.json();
  });
    
  promise = promise.catch(err => {
    console.error(`Error loading ${fetchUrl}`, err);
    delete cache[key];
    return null;
  });
    
  cache[key] = promise;
  return promise;
};

export const clearDatasetCache = () => {
  for (let key in cache) {
    delete cache[key];
  }
};
