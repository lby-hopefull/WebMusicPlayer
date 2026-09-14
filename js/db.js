// ========== IndexedDB 操作函数 ==========
function dbStore(storeName, mode='readonly') {
  return db.transaction([storeName], mode).objectStore(storeName);
}

function dbGet(storeName, key) {
  return new Promise(resolve => {
    if(!db) return resolve(null);
    const req = dbStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function dbPut(storeName, key, value) {
  return new Promise(resolve => {
    if(!db) return resolve(false);
    const req = dbStore(storeName, 'readwrite').put({id: key, data: value});
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

function dbGetAll(storeName) {
  return new Promise(resolve => {
    if(!db) return resolve([]); 
    const req = dbStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

function dbClear(storeName) {
  return new Promise(resolve => {
    if(!db) return resolve(false);
    const req = dbStore(storeName, 'readwrite').clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

function dbDelete(storeName, key) {
  return new Promise(resolve => {
    if(!db) return resolve(false);
    const req = dbStore(storeName, 'readwrite').delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

function initDB(){
  return new Promise(res=>{
    const req=indexedDB.open(dbName, 4);
    req.onupgradeneeded=e=>{ 
      const database = e.target.result;
      storeNames.forEach(name => {
        if(!database.objectStoreNames.contains(name)) {
          database.createObjectStore(name, {keyPath:'id'});
        }
      });
    };
    req.onsuccess=e=>{ db=e.target.result; res(true); };
    req.onerror=()=>res(false);
  });
}

function getMusic(name){
  return new Promise(r=>{
    if(!db)return r(null);
    const tx=db.transaction([storeName],'readonly');
    tx.objectStore(storeName).get(name).onsuccess=e=>r(e.target.result?e.target.result.data:null);
  });
}

function saveMusic(name,data){
  if(!db)return;
  db.transaction([storeName],'readwrite').objectStore(storeName).put({id:name,data});
}

