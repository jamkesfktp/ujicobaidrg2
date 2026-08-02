// src/utils/dataLoader.js

const cache = {};
// Use a fixed timestamp for the current session to bypass old browser caches,
// but keep the same URL during the session so the browser can cache it if needed.
const SESSION_VERSION = Date.now(); 

export const loadDatasetFile = async (dataset, fileType, month = 'all', drgType = 'all') => {
  const isD3 = dataset.startsWith('dataset3');
  const isD4 = dataset.startsWith('dataset4');
  const d3DrgType = dataset.includes('_') ? dataset.split('_')[1] : drgType;
  
  const key = isD3 ? `${dataset}_${fileType}_${month}_${d3DrgType}` : `${dataset}_${fileType}`;
  
  if (cache[key]) {
    return cache[key];
  }
  
  const getUrl = (ft) => {
    if (ft === 'inacbg_to_drg') {
      if (isD4) return `/data/dataset4/dataset4_inacbg_to_drg.json?v=${SESSION_VERSION}`;
      // dataset3 inacbg_to_drg is at root level, not in /dataset3/ subfolder
      if (isD3) return `/data/dataset3_inacbg_to_drg.json?v=${SESSION_VERSION}`;
      const parentDir = dataset.split('_')[0];
      return `/data/${parentDir}/${dataset}_inacbg_to_drg.json?v=${SESSION_VERSION}`;
    }
    if (isD3) {
      if (ft.startsWith('hospitals/')) {
         return `/data/dataset3/${ft}.json?v=${SESSION_VERSION}`;
      }
      const baseDataset = dataset.replace(/_(1363|1370)$/, '');
      return `/data/dataset3/${baseDataset}_${ft}_${month}_${d3DrgType}.json?v=${SESSION_VERSION}`;
    }
    if (isD4) {
      if (ft.startsWith('hospitals/')) {
        return `/data/dataset4/${ft}.json?v=${SESSION_VERSION}`;
      }
      // dataset4 files are flat: dataset4_hospitals.json.gz, NOT dataset4_1363_hospitals.json.gz
      return `/data/dataset4/dataset4_${ft}.json?v=${SESSION_VERSION}`;
    }
    if (ft.startsWith('hospitals/')) {
      return `/data/${ft}.json?v=${SESSION_VERSION}`;
    }
    
    // Default case for dataset1_1363, dataset2_1370, etc.
    return `/data/${dataset}_${ft}.json?v=${SESSION_VERSION}`;
  };

  const fetchUrl = getUrl(fileType);
  
  let promise;
  
  if (isD3 && fileType === 'hospitals') {
    // We already have cases, inacbg, and sim directly in hospitals now
    promise = fetch(fetchUrl).then(res => res.json());
  } else if (isD3 && fileType === 'services') {
    // Merge crosstab sim into services
    const srvPromise = fetch(fetchUrl).then(res => res.json());
    const crossPromise = fetch(getUrl('crosstab')).then(res => res.json()).catch(() => ({}));
    
    promise = Promise.all([srvPromise, crossPromise]).then(([srv, cross]) => {
      if (cross && cross.byLayanan) {
        Object.keys(srv).forEach(lay => {
          if (cross.byLayanan[lay] && cross.byLayanan[lay].sim) {
            Object.assign(srv[lay], cross.byLayanan[lay].sim);
          }
        });
      }
      return srv;
    });
  } else {
    promise = fetch(fetchUrl).then(res => {
      if (!res.ok) throw new Error(`Failed to load ${fileType} from ${fetchUrl}`);
      return res.json();
    });
  }
    
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
