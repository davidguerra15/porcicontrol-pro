import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Trash2, Download, Settings, 
  History, CheckCircle, MapPin, Leaf, ShoppingCart, Printer, Edit3, X, Database, Cloud, ArrowRightLeft
} from 'lucide-react';

// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// --- CREDENCIALES DE TU APP ORIGINAL (AGROCONTROL) ---
const firebaseConfig = {
  apiKey: "AIzaSyCA5_C3pPeR4wmcBh_l9KoeYxkK1hYWqeY",
  authDomain: "agroporcina.firebaseapp.com",
  projectId: "agroporcina",
  storageBucket: "agroporcina.firebasestorage.app",
  messagingSenderId: "801753998722",
  appId: "1:801753998722:web:9e16157c0a157662e81b9b",
  measurementId: "G-6WJWTY0545"
};

// Inicializamos la conexión y la autenticación
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// --- HOOK DE BASE DE DATOS LOCAL ---
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });
  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };
  return [storedValue, setValue];
}

const DEFAULT_FEED_DATA = [
  { id: 'v1', stage: 'VITALECHON 1 (50lbs)', dailyLb: 0.601, totalLb: 6.6, priceQ: 405, bagSize: 50, nextStageId: 'v2' },
  { id: 'v2', stage: 'VITALECHON 2 (50lbs)', dailyLb: 1.101, totalLb: 11.0, priceQ: 296, bagSize: 50, nextStageId: 'v3' },
  { id: 'v3', stage: 'VITALECHON 3 (50lbs)', dailyLb: 1.573, totalLb: 11.0, priceQ: 226, bagSize: 50, nextStageId: 'v4' },
  { id: 'v4', stage: 'VITALECHON 4 (100lbs)', dailyLb: 2.308, totalLb: 48.4, priceQ: 332, bagSize: 100, nextStageId: 'c1' },
  { id: 'c1', stage: 'VITACERDO 1 (100lbs)', dailyLb: 3.120, totalLb: 74.76, priceQ: 299, bagSize: 100, nextStageId: 'c2' },
  { id: 'c2', stage: 'VITACERDO 2 (100lbs)', dailyLb: 4.390, totalLb: 175.14, priceQ: 268, bagSize: 100, nextStageId: 'c3' },
  { id: 'c3', stage: 'VITACERDO 3 (100lbs)', dailyLb: 5.810, totalLb: 169.47, priceQ: 262, bagSize: 100, nextStageId: '' }
];

const formatCurrency = (value) => new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(value);
const formatNumber = (value) => Number(value).toFixed(2);
const generateId = () => Math.random().toString(36).substr(2, 6).toUpperCase();

export default function App() {
  const [view, setView] = useState('calculator'); 
  const [feedData, setFeedData] = useLocalStorage('agro_calculator_feeds_v3', DEFAULT_FEED_DATA);
  const [corrals, setCorrals] = useLocalStorage('agro_corrals_v4', []);
  const [purchaseHistory, setPurchaseHistory] = useLocalStorage('agro_purchase_history', []);
  
  const [bagOverrides, setBagOverrides] = useState({});
  const folio = useMemo(() => generateId(), []);
  const [newFeed, setNewFeed] = useState({ stage: '', dailyLb: 0, totalLb: 0, priceQ: 0, bagSize: 100, nextStageId: '' });

  // Estados para Modal "Modo Dios"
  const [editingCorralHistory, setEditingCorralHistory] = useState(null);
  const [tempHistoryBags, setTempHistoryBags] = useState({});

  // Estados de la Nube (Firebase)
  const [firebaseStock, setFirebaseStock] = useState({});
  const [firebaseStatus, setFirebaseStatus] = useState('Autenticando...');
  const [user, setUser] = useState(null);

  // Estados para procesar datos en bruto de la app original
  const [rawCorrales, setRawCorrales] = useState([]);
  const [rawLotes, setRawLotes] = useState([]);
  const [rawAlimentos, setRawAlimentos] = useState([]);
  const [rawBodega, setRawBodega] = useState([]);
  const [rawBajas, setRawBajas] = useState([]);

  // --- 1. AUTENTICACIÓN INVISIBLE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Error al autenticar con Firebase:", error);
        setFirebaseStatus('Error de Permisos (Auth)');
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // --- 2. DESCARGA SIMULTÁNEA DE COLECCIONES (CEREBRO CRUZADO) ---
  useEffect(() => {
    if (!user) return;

    setFirebaseStatus('Conectando...');
    try {
      const APP_ID = "agrocontrol-local"; 
      const sharedDataRef = collection(db, "artifacts", APP_ID, "public", "data", "granja_compartida");

      const unsubCorrales = onSnapshot(doc(sharedDataRef, "agro_corrales"), (snap) => setRawCorrales(snap.exists() ? (snap.data().data || []) : []));
      const unsubLotes = onSnapshot(doc(sharedDataRef, "agro_lotes"), (snap) => setRawLotes(snap.exists() ? (snap.data().data || []) : []));
      const unsubAlimentos = onSnapshot(doc(sharedDataRef, "agro_alimentos"), (snap) => setRawAlimentos(snap.exists() ? (snap.data().data || []) : []));
      const unsubBodega = onSnapshot(doc(sharedDataRef, "agro_bodega"), (snap) => setRawBodega(snap.exists() ? (snap.data().data || []) : []));
      const unsubBajas = onSnapshot(doc(sharedDataRef, "agro_bajas"), (snap) => setRawBajas(snap.exists() ? (snap.data().data || []) : []));

      return () => { unsubCorrales(); unsubLotes(); unsubAlimentos(); unsubBodega(); unsubBajas(); };
    } catch (error) {
      console.error("Error al conectar Firebase:", error);
      setFirebaseStatus('Desconectado');
    }
  }, [user]);

  // --- 3. MAPEADOR INTELIGENTE DE CORRALES ---
  useEffect(() => {
    if (rawCorrales.length > 0 && rawLotes.length > 0) {
        setCorrals(prevLocal => {
            const mappedFromCloud = [];

            rawCorrales.forEach(corralBase => {
                const loteActivo = rawLotes.find(l => l.corralId === corralBase.id && l.estado === 'Activo');
                
                if (loteActivo) {
                    const existingLocal = prevLocal.find(l => l.id === corralBase.id);

                    const muertesLote = rawBajas.filter(b => b.loteId === loteActivo.id).reduce((sum, b) => sum + (b.cantidad || 0), 0);
                    const cerdosVivos = Math.max(0, (loteActivo.cantidad || 0) - muertesLote);

                    const alimentosDeEsteLote = rawAlimentos.filter(a => a.loteId === loteActivo.id);
                    const alimentosTolvaDesc = [...alimentosDeEsteLote]
                        .filter(a => !a.esSuplemento)
                        .sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
                    
                    let stageId = '';

                    if (alimentosTolvaDesc.length > 0) {
                        const ultimoNombreConcentrado = (alimentosTolvaDesc[0].tipo || '').trim().toUpperCase();
                        const match = feedData.find(f => f.stage.toUpperCase().includes(ultimoNombreConcentrado));
                        if (match) stageId = match.id;
                    }

                    if (!stageId) {
                        const faseIndex = (loteActivo.faseActual || 1) - 1;
                        stageId = feedData[faseIndex] ? feedData[faseIndex].id : (feedData[0]?.id || '');
                    }

                    const history = {};
                    feedData.forEach(feed => {
                        const baseName = feed.stage.split('(')[0].trim().toUpperCase();
                        
                        const librasConsumidas = alimentosDeEsteLote.reduce((sum, a) => {
                            if (!a.esSuplemento && (a.tipo || '').toUpperCase() === baseName) return sum + (a.cantidadLb || 0);
                            if (a.esSuplemento && a.ingredientesUsados) {
                                const match = a.ingredientesUsados.find(u => (u.nombre || '').toUpperCase() === baseName);
                                if (match) return sum + (match.libras || 0);
                            }
                            return sum;
                        }, 0);

                        if (librasConsumidas > 0) {
                            history[feed.id] = librasConsumidas / 100;
                        }
                    });

                    mappedFromCloud.push({
                        id: corralBase.id,
                        name: corralBase.nombre || 'Corral Sincronizado',
                        pigs: cerdosVivos,
                        biologicalStageId: existingLocal?.biologicalStageId || stageId, // Biología
                        stageId: existingLocal?.stageId || stageId, // Empaque Físico
                        days: existingLocal?.days || 30,
                        mode: existingLocal?.mode || 'dias',
                        budget: existingLocal?.budget || 1000,
                        historyConsumed: history,
                        fromCloud: true
                    });
                }
            });

            const localOnly = prevLocal.filter(l => !l.fromCloud && !mappedFromCloud.find(mc => mc.id === l.id));
            return [...mappedFromCloud, ...localOnly];
        });
        setFirebaseStatus('Sincronizado');
    }
  }, [rawCorrales, rawLotes, rawAlimentos, rawBajas, feedData]);

  // --- 4. MAPEADOR INTELIGENTE DE BODEGA ---
  useEffect(() => {
    const newStock = {};
    feedData.forEach(feed => {
        const baseName = feed.stage.split('(')[0].trim().toUpperCase();
        
        const sacosComprados = rawBodega.filter(b => (b.tipo || '').toUpperCase() === baseName).reduce((sum, b) => sum + (b.sacos || 0), 0);
        const librasCompradas = sacosComprados * feed.bagSize;

        const librasConsumidas = rawAlimentos.reduce((sum, a) => {
            if (!a.esSuplemento && (a.tipo || '').toUpperCase() === baseName) return sum + (a.cantidadLb || 0);
            if (a.esSuplemento && a.ingredientesUsados) {
                const match = a.ingredientesUsados.find(u => (u.nombre || '').toUpperCase() === baseName);
                if (match) return sum + (match.libras || 0);
            }
            return sum;
        }, 0);

        const librasEnStock = Math.max(0, librasCompradas - librasConsumidas);
        newStock[feed.id] = parseFloat((librasEnStock / feed.bagSize).toFixed(1));
    });
    setFirebaseStock(newStock);
  }, [rawBodega, rawAlimentos, feedData]);

  // --- GESTIÓN DE CORRALES ---
  const handleAddCorral = () => {
    setCorrals([...corrals, { 
        id: generateId(), 
        name: `Lote Local ${corrals.length + 1}`, 
        pigs: 10, 
        mode: 'dias', 
        biologicalStageId: feedData[0]?.id || '',
        stageId: feedData[0]?.id || '', 
        days: 15, 
        budget: 1000,
        historyConsumed: {},
        fromCloud: false
    }]);
  };

  const updateCorral = (id, field, value) => {
    setCorrals(corrals.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeCorral = (id) => setCorrals(corrals.filter(c => c.id !== id));

  const handleUpdateFeed = (id, field, value) => {
    setFeedData(feedData.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleAddFeed = () => {
    if (!newFeed.stage) return;
    setFeedData([...feedData, { ...newFeed, id: generateId().toLowerCase() }]);
    setNewFeed({ stage: '', dailyLb: 0, totalLb: 0, priceQ: 0, bagSize: 100, nextStageId: '' });
  };

  const handleRemoveFeed = (id) => {
    if (feedData.length === 1) return;
    setFeedData(feedData.filter(f => f.id !== id));
  };

  const handleBagOverride = (stageId, newBags) => {
    setBagOverrides(prev => ({ ...prev, [stageId]: newBags }));
  };
  
  const handleDeleteHistoryRecord = (id) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este registro del historial?")) {
      setPurchaseHistory(purchaseHistory.filter(h => h.id !== id));
    }
  };

  const toggleCorralView = (id) => {
      setCorralViewMode(prev => ({ ...prev, [id]: prev[id] === 'bio' ? 'tolva' : 'bio' }));
  };

  // --- MODO DIOS: EDITOR DE HISTORIAL REAL ---
  const openHistoryModal = (corral) => {
    const temp = {};
    feedData.forEach(feed => {
      const quintales = Number(corral.historyConsumed?.[feed.id]) || 0;
      temp[feed.id] = (quintales * 100) / feed.bagSize;
    });
    setTempHistoryBags(temp);
    setEditingCorralHistory(corral.id);
  };

  const saveHistoryModal = () => {
    const updatedCorrals = corrals.map(c => {
      if (c.id === editingCorralHistory) {
        const newHistory = {};
        feedData.forEach(feed => {
          const bags = Number(tempHistoryBags[feed.id]) || 0;
          if (bags > 0) {
            newHistory[feed.id] = (bags * feed.bagSize) / 100;
          }
        });
        return { ...c, historyConsumed: newHistory };
      }
      return c;
    });
    setCorrals(updatedCorrals);
    setEditingCorralHistory(null);
  };

  // --- MOTOR MATEMÁTICO RECURSIVO MULTI-ETAPA (SEPARACIÓN BIO/FÍSICO) ---
  const processedCorrals = useMemo(() => {
    return corrals.map(corral => {
      let currentBioStage = feedData.find(s => s.id === (corral.biologicalStageId || corral.stageId)) || feedData[0];
      let currentFeedStage = feedData.find(s => s.id === corral.stageId) || currentBioStage;

      if (!currentBioStage) return { ...corral, items: [], calculatedCost: 0, summaryText: 'Error' };

      let items = [];
      let totalCorralCost = 0;
      let remainingDays = corral.mode === 'dias' ? Number(corral.days || 0) : 0;
      let safePigs = Number(corral.pigs) || 0;
      
      if (corral.mode !== 'dias') {
          let lbs = 0;
          if (corral.mode === 'etapa') {
            const totalStageReq = safePigs * currentBioStage.totalLb;
            const boughtCurrent = (Number(corral.historyConsumed?.[currentBioStage.id]) || 0) * 100;
            lbs = Math.max(0, totalStageReq - boughtCurrent);
          } else if (corral.mode === 'presupuesto') {
            lbs = (Number(corral.budget || 0) / currentFeedStage.priceQ) * 100;
          }
          
          const cost = (lbs / 100) * currentFeedStage.priceQ;
          items.push({ 
              stageDetails: currentFeedStage, 
              biologicalStage: currentBioStage,
              calculatedLbs: lbs, 
              calculatedBags: lbs / currentFeedStage.bagSize, 
              calculatedCost: cost, 
              isClosing: false, 
              isTransition: currentBioStage.id !== currentFeedStage.id
          });
          return { ...corral, items, calculatedCost: cost, summaryText: corral.mode === 'etapa' ? 'Restante Etapa' : 'Presupuesto' };
      }

      // --- MODO DÍAS: BUCLE INTELIGENTE ---
      let iterations = 0;
      let tempBioStage = currentBioStage;
      let tempFeedStage = currentFeedStage;
      let historyAlreadyApplied = false;

      while (remainingDays > 0 && tempBioStage && iterations < 20) {
          const maxDaysEtapa = tempBioStage.dailyLb > 0 ? tempBioStage.totalLb / tempBioStage.dailyLb : 999;
          
          let daysAlreadyDone = 0;
          if (!historyAlreadyApplied) {
              const lbsCurrent = (Number(corral.historyConsumed?.[tempBioStage.id]) || 0) * 100;
              daysAlreadyDone = lbsCurrent / (safePigs * tempBioStage.dailyLb || 1); 
          }

          const daysLeftInEtapa = Math.max(0, maxDaysEtapa - daysAlreadyDone);
          const daysToConsume = Math.min(remainingDays, daysLeftInEtapa);
          
          if (daysToConsume > 0 || (!historyAlreadyApplied && remainingDays > 0)) {
              const isClosing = !historyAlreadyApplied && remainingDays >= (daysLeftInEtapa * 0.9);
              const actualDays = isClosing ? daysLeftInEtapa : daysToConsume;
              
              // EL CERDO COME SEGÚN SU EDAD BIOLÓGICA (Ej. 4.39 lbs/día)
              let lbs = safePigs * actualDays * tempBioStage.dailyLb;
              
              // EL SACO Y EL PRECIO SE COBRAN SEGÚN LO QUE ECHES A LA TOLVA
              const cost = (lbs / 100) * tempFeedStage.priceQ;
              
              if (lbs > 0 || (!historyAlreadyApplied)) {
                  items.push({
                      stageDetails: tempFeedStage,
                      biologicalStage: tempBioStage,
                      calculatedLbs: lbs,
                      calculatedBags: lbs / tempFeedStage.bagSize,
                      calculatedCost: cost,
                      isClosing: isClosing && tempBioStage.id === tempFeedStage.id,
                      isTransition: tempBioStage.id !== tempFeedStage.id
                  });
                  totalCorralCost += cost;
              }
              
              remainingDays -= actualDays;
          }

          // Al avanzar la biología, asumimos que regresamos al alimento natural de la etapa (si no hay otro override manual futuro)
          let nextId = tempBioStage.nextStageId;
          let nextStage = feedData.find(f => f.id === nextId);

          if (!nextStage && nextId !== '') {
              const currentIndex = feedData.findIndex(f => f.id === tempBioStage.id);
              if (currentIndex >= 0 && currentIndex < feedData.length - 1) {
                  nextStage = feedData[currentIndex + 1];
              }
          }

          tempBioStage = nextStage;
          tempFeedStage = nextStage; // El concentrado vuelve a sincronizarse con la biología en la siguiente etapa
          historyAlreadyApplied = true;
          iterations++;
          
          if (!tempBioStage && remainingDays > 0 && items.length > 0) {
              const lastItem = items[items.length - 1];
              let extraLbs = safePigs * remainingDays * lastItem.biologicalStage.dailyLb;
              
              const extraCost = (extraLbs / 100) * lastItem.stageDetails.priceQ;
              lastItem.calculatedLbs += extraLbs;
              lastItem.calculatedBags += (extraLbs / lastItem.stageDetails.bagSize);
              lastItem.calculatedCost += extraCost;
              totalCorralCost += extraCost;
              remainingDays = 0;
          }
      }

      const groupedMap = new Map();
      items.forEach(it => {
          if (groupedMap.has(it.stageDetails.id)) {
              const existing = groupedMap.get(it.stageDetails.id);
              existing.calculatedLbs += it.calculatedLbs;
              existing.calculatedBags += it.calculatedBags;
              existing.calculatedCost += it.calculatedCost;
          } else {
              groupedMap.set(it.stageDetails.id, { ...it });
          }
      });
      const finalItems = Array.from(groupedMap.values());

      return { ...corral, items: finalItems, calculatedCost: totalCorralCost, summaryText: `${corral.days} Días Proyectados` };
    });
  }, [corrals, feedData]);

  // --- CONSOLIDADOR DE ORDEN Y BODEGA ---
  const orderSummary = useMemo(() => {
    const summary = {};
    processedCorrals.forEach(c => {
      c.items.forEach(item => {
          if (item.calculatedLbs <= 0) return;
          if (!summary[item.stageDetails.id]) {
              summary[item.stageDetails.id] = { stageDetails: item.stageDetails, totalLbs: 0 };
          }
          summary[item.stageDetails.id].totalLbs += item.calculatedLbs;
      });
    });

    let grandTotalCost = 0;
    const items = Object.values(summary).map(item => {
      const exactBags = item.totalLbs / item.stageDetails.bagSize;
      const autoRounded = Math.ceil(exactBags);
      const userOverride = bagOverrides[item.stageDetails.id];
      const finalBags = userOverride !== undefined ? userOverride : autoRounded;
      const finalCost = finalBags * (item.stageDetails.bagSize / 100) * item.stageDetails.priceQ;
      grandTotalCost += finalCost;

      return { ...item, exactBags, autoRounded, roundedBags: finalBags, isOverridden: userOverride !== undefined };
    });

    return { items, grandTotalCost };
  }, [processedCorrals, bagOverrides]);

  const handleFinalizePurchase = () => {
    if (orderSummary.items.length === 0) return;
    
    const updatedCorrals = corrals.map(corral => {
        const processed = processedCorrals.find(p => p.id === corral.id);
        const newHistory = { ...corral.historyConsumed };
        
        processed.items.forEach(item => {
            const summaryItem = orderSummary.items.find(i => i.stageDetails.id === item.stageDetails.id);
            if (summaryItem && summaryItem.totalLbs > 0) {
                const ratio = item.calculatedLbs / summaryItem.totalLbs;
                const assignedBags = summaryItem.roundedBags * ratio;
                const assignedQuintales = (assignedBags * item.stageDetails.bagSize) / 100;
                newHistory[item.stageDetails.id] = (Number(newHistory[item.stageDetails.id]) || 0) + assignedQuintales;
            }
        });
        
        return { ...corral, historyConsumed: newHistory };
    });
    
    setCorrals(updatedCorrals);
    
    const record = {
        id: folio,
        date: new Date().toISOString(),
        total: orderSummary.grandTotalCost,
        items: orderSummary.items.map(i => ({ stage: i.stageDetails.stage, bags: i.roundedBags }))
    };
    setPurchaseHistory([record, ...purchaseHistory]);
    setBagOverrides({});
    alert("Compra finalizada. El historial local ha tomado la cantidad exacta editada.");
  };

  const downloadPDF = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white font-sans text-slate-800 pb-12 print:pb-0">
      
      {/* HEADER */}
      <header className="bg-white px-6 py-4 sticky top-0 z-30 flex justify-between items-center shadow-sm border-b border-slate-100 print:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 text-white p-2.5 rounded-xl"><Leaf size={24} /></div>
          <div>
            <div className="flex items-center gap-2">
                <h1 className="text-slate-900 font-black text-lg leading-none">PorciControl PRO</h1>
                <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider flex items-center gap-1 ${firebaseStatus === 'Sincronizado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    <Database size={10} /> {firebaseStatus}
                </div>
            </div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Gestión de Ciclos y Saltos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView(view === 'history' ? 'calculator' : 'history')} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-full hover:bg-slate-200 transition-all font-bold text-xs flex items-center gap-2">
            <History size={14} /> {view === 'history' ? 'Volver' : 'Historial'}
          </button>
          <button onClick={() => setView(view === 'config' ? 'calculator' : 'config')} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-full hover:bg-slate-200 transition-all font-bold text-xs flex items-center gap-2">
            <Settings size={14} /> {view === 'config' ? 'Volver' : 'Catálogo'}
          </button>
          <button onClick={downloadPDF} className="bg-emerald-600 text-white px-6 py-2 rounded-full text-xs font-black shadow-md hover:bg-emerald-500 transition-all flex items-center gap-2 active:scale-95">
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8 print:py-0 print:m-0">
        
        {/* VISTA: HISTORIAL */}
        {view === 'history' && (
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 animate-in fade-in print:hidden">
                <h2 className="text-2xl font-black mb-6 flex items-center gap-3"><History className="text-emerald-600"/> Historial de Compras Local</h2>
                <div className="space-y-4">
                    {purchaseHistory.map(h => (
                        <div key={h.id} className="p-4 border rounded-2xl flex justify-between items-center bg-slate-50/50 group hover:border-emerald-200 transition-colors">
                            <div>
                                <p className="font-black text-slate-700">Folio: #{h.id}</p>
                                <p className="text-xs text-slate-400">{new Date(h.date).toLocaleString()}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {h.items.map((it, idx) => (
                                        <span key={idx} className="bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-sm">{it.stage}: {it.bags} scs</span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <p className="font-black text-emerald-700 text-xl">{formatCurrency(h.total)}</p>
                              <button 
                                onClick={() => handleDeleteHistoryRecord(h.id)} 
                                className="text-slate-300 hover:text-red-500 bg-white p-2.5 rounded-xl shadow-sm transition-all opacity-0 group-hover:opacity-100 border border-slate-100"
                                title="Eliminar registro"
                              >
                                <Trash2 size={18}/>
                              </button>
                            </div>
                        </div>
                    ))}
                    {purchaseHistory.length === 0 && <p className="text-center text-slate-400 py-10">No hay compras registradas en este equipo.</p>}
                </div>
            </div>
        )}

        {/* VISTA: CONFIGURACIÓN */}
        {view === 'config' && (
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 animate-in fade-in print:hidden">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3"><Settings className="text-emerald-600"/> Catálogo Maestro</h2>
            <div className="overflow-x-auto border rounded-3xl">
              <table className="w-full text-left text-sm border-collapse min-w-[900px]">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="p-4">Etapa</th>
                    <th className="p-4">Día (lb)</th>
                    <th className="p-4">Total (lb)</th>
                    <th className="p-4">Precio QQ</th>
                    <th className="p-4 text-center">Stock Bodega (Nube)</th>
                    <th className="p-4">Siguiente Etapa</th>
                    <th className="p-4 text-center">Eliminar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {feedData.map(f => (
                    <tr key={f.id} className="hover:bg-slate-50/50 group">
                      <td className="p-2"><input type="text" value={f.stage} onChange={(e) => handleUpdateFeed(f.id, 'stage', e.target.value)} className="w-full p-2 font-black text-slate-800 bg-transparent border-transparent focus:bg-white rounded outline-none"/></td>
                      <td className="p-2"><input type="number" step="0.01" value={f.dailyLb} onChange={(e) => handleUpdateFeed(f.id, 'dailyLb', Number(e.target.value))} className="w-full p-2 font-mono text-slate-600 bg-transparent outline-none"/></td>
                      <td className="p-2"><input type="number" step="0.01" value={f.totalLb} onChange={(e) => handleUpdateFeed(f.id, 'totalLb', Number(e.target.value))} className="w-full p-2 font-mono text-slate-600 bg-transparent outline-none"/></td>
                      <td className="p-2"><input type="number" value={f.priceQ} onChange={(e) => handleUpdateFeed(f.id, 'priceQ', Number(e.target.value))} className="w-full p-2 font-mono font-black text-emerald-700 bg-transparent outline-none"/></td>
                      <td className="p-2 text-center font-black text-indigo-600 bg-indigo-50/30 rounded">
                        {firebaseStock[f.id] !== undefined ? `${firebaseStock[f.id]} scs` : '-'}
                      </td>
                      <td className="p-2">
                        <select value={f.nextStageId || ''} onChange={(e) => handleUpdateFeed(f.id, 'nextStageId', e.target.value)} className="w-full p-2 text-xs font-bold text-slate-600 bg-transparent outline-none">
                            <option value="">(Fin)</option>
                            {feedData.filter(o => o.id !== f.id).map(o => <option key={o.id} value={o.id}>{o.stage}</option>)}
                        </select>
                      </td>
                      <td className="p-2 text-center"><button onClick={() => handleRemoveFeed(f.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA: CALCULADORA */}
        {view === 'calculator' && (
          <>
            <section className="print:hidden space-y-6">
              <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard de Compras</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Sincronizado en tiempo real con AgroControl.</p>
                </div>
                <button onClick={handleAddCorral} className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-full text-xs font-black hover:border-emerald-300 shadow-sm flex items-center gap-2">
                  <Plus size={16}/> Nuevo Corral Local
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {processedCorrals.map(c => {
                  const currentFeedDef = feedData.find(f => f.id === c.stageId);
                  
                  let totalBagsConsumed = 0;
                  if (c.historyConsumed) {
                      Object.keys(c.historyConsumed).forEach(k => {
                         const f = feedData.find(fd => fd.id === k);
                         const consumedVal = Number(c.historyConsumed[k]);
                         if (f && !isNaN(consumedVal)) {
                             totalBagsConsumed += (consumedVal * 100) / f.bagSize;
                         }
                      });
                  }

                  return (
                  <div key={c.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 flex flex-col group overflow-hidden relative">
                    <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-2 w-2/3">
                          <input type="text" value={c.name} onChange={e => updateCorral(c.id, 'name', e.target.value)} disabled={c.fromCloud} className="bg-transparent font-black text-lg text-slate-800 focus:ring-0 outline-none w-full" title={c.fromCloud ? "Nombre sincronizado desde la nube" : "Editar nombre"} />
                          {c.fromCloud && <Cloud size={16} className="text-emerald-500 flex-shrink-0" title="Corral sincronizado desde la nube"/>}
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => openHistoryModal(c)} className="text-slate-400 hover:text-indigo-600 p-2 bg-white rounded-full shadow-sm border border-slate-100" title="Editar Saldo/Historial Real"><Edit3 size={16}/></button>
                          {!c.fromCloud && <button onClick={() => removeCorral(c.id)} className="text-slate-400 hover:text-red-500 p-2 bg-white rounded-full shadow-sm border border-slate-100"><Trash2 size={16}/></button>}
                      </div>
                    </div>

                    <div className="p-6 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cerdos</label>
                        <input type="number" value={c.pigs} onChange={e => updateCorral(c.id, 'pigs', Number(e.target.value))} disabled={c.fromCloud} title={c.fromCloud ? "Población sincronizada desde la nube" : "Editar cerdos"} className="w-full text-sm font-black bg-slate-50 border-none rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed" />
                      </div>
                      
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1" title="Determina el apetito y la masa necesaria del cerdo">Etapa Biológica Real</label>
                        <select value={c.biologicalStageId || c.stageId} onChange={e => updateCorral(c.id, 'biologicalStageId', e.target.value)} className="w-full text-sm font-black bg-slate-50 border-none rounded-xl px-3 py-2 outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500">
                          {feedData.map(f => <option key={f.id} value={f.id}>{f.stage}</option>)}
                        </select>
                      </div>

                      <div className="col-span-2 border-t border-slate-100 pt-3">
                        <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block mb-1" title="Producto que estás comprando para la tolva">Concentrado a Comprar (Tolva)</label>
                        <select value={c.stageId} onChange={e => updateCorral(c.id, 'stageId', e.target.value)} className="w-full text-sm font-black bg-indigo-50 text-indigo-900 border-none rounded-xl px-3 py-2 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500">
                          {feedData.map(f => <option key={f.id} value={f.id}>{f.stage}</option>)}
                        </select>
                      </div>

                      <div className="col-span-2 grid grid-cols-2 gap-4 pt-2">
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Método de Proyección</label>
                            <select value={c.mode} onChange={e => updateCorral(c.id, 'mode', e.target.value)} className="w-full text-sm font-black bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer">
                              <option value="dias">Por Días</option>
                              <option value="etapa">Restante de Biología</option>
                              <option value="presupuesto">Presupuesto</option>
                            </select>
                          </div>
                          <div>
                            {(c.mode === 'dias' || c.mode === 'presupuesto') && (
                              <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valor</label>
                                  <input type="number" value={c.mode === 'dias' ? c.days : c.budget} onChange={e => updateCorral(c.id, c.mode === 'dias' ? 'days' : 'budget', Number(e.target.value))} className="w-full text-sm font-black bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-slate-500" />
                              </div>
                            )}
                          </div>
                      </div>
                      
                      <div className="col-span-2 pt-2">
                        <div className="flex justify-between items-center text-[9px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span>Sacos Consumidos en este Lote:</span>
                            <span className="font-black text-slate-700">{formatNumber(totalBagsConsumed)} scs</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-emerald-600 text-white p-5 mt-auto">
                        <div className="flex justify-between items-center mb-3">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-200">{c.summaryText}</p>
                            <p className="text-xs font-mono font-bold">{formatCurrency(c.calculatedCost)}</p>
                        </div>
                        <div className="space-y-2">
                            {c.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-emerald-700/50 px-3 py-2 rounded-lg border border-emerald-500/30">
                                    <div className="w-2/3">
                                        <p className="font-bold text-xs truncate leading-tight">{item.stageDetails.stage}</p>
                                        <p className="text-[8px] text-emerald-200 uppercase tracking-widest">
                                            {item.isTransition ? 'Salto de Dieta' : (item.isClosing ? 'Cierre de Etapa' : 'Dieta Base')}
                                        </p>
                                    </div>
                                    <p className="text-xl font-black">{formatNumber(item.calculatedBags)} <span className="text-[7px] uppercase text-emerald-300">Scs</span></p>
                                </div>
                            ))}
                        </div>
                    </div>
                  </div>
                )})}
              </div>
            </section>

            {/* SECCIÓN PDF (Imprimible puro) */}
            <div className="w-full flex flex-col items-center mt-12 mb-8 gap-6 print:mt-0 print:mb-0 print:block">
              <section id="orden-compra-agro" className="bg-white p-8 rounded-3xl border border-slate-200 w-[720px] print:w-full print:max-w-none print:shadow-none print:border-none print:p-0 print:m-0 mx-auto text-slate-800 shadow-2xl relative overflow-hidden print:overflow-visible">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-bl-full -z-0 opacity-50 print:hidden"></div>
                <div className="flex justify-between items-start border-b border-slate-200 pb-5 mb-6 relative z-10">
                  <div className="flex gap-4 items-center">
                    <div className="bg-emerald-600 text-white p-3 rounded-2xl"><Leaf size={32} /></div>
                    <div>
                      <h2 className="text-3xl font-black uppercase tracking-tighter leading-none text-slate-900">PorciControl</h2>
                      <p className="text-[9px] font-black text-emerald-600 uppercase mt-1 tracking-widest">Orden de Requisición</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Folio: #{folio}</p>
                    <p className="text-xl font-black font-mono text-slate-900">{new Date().toLocaleDateString('es-GT')}</p>
                  </div>
                </div>

                <div className="space-y-8 relative z-10">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500"/> Consolidado Global de Sacos</h3>
                    <div className="border rounded-2xl overflow-hidden shadow-sm print:border-slate-300">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b print:bg-white print:border-slate-300">
                                <tr className="text-[9px] uppercase font-black text-slate-500 tracking-widest">
                                    <th className="py-3 px-4 w-2/5">Concentrado</th>
                                    <th className="py-3 px-4 text-center">Peso Estimado</th>
                                    <th className="py-3 px-4 text-center print:hidden">Stock Bodega</th>
                                    <th className="py-3 px-4 text-right">Compra Final</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y bg-white print:divide-slate-200">
                                {orderSummary.items.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="py-3 px-4 font-black text-[11px] uppercase">{item.stageDetails.stage}</td>
                                    <td className="py-3 px-4 text-center font-mono text-slate-500">{formatNumber(item.totalLbs)} lb</td>
                                    <td className="py-3 px-4 text-center text-[10px] font-bold text-indigo-500 print:hidden">
                                        {firebaseStock[item.stageDetails.id] !== undefined ? `${firebaseStock[item.stageDetails.id]} scs` : '-'}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleBagOverride(item.stageDetails.id, Math.max(0, item.roundedBags - 1))} className="print:hidden w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-black">-</button>
                                            <div className="bg-emerald-50 print:bg-transparent print:border-0 text-emerald-800 print:text-slate-900 px-3 py-1 rounded-lg border border-emerald-100 font-black text-lg">{item.roundedBags}</div>
                                            <button onClick={() => handleBagOverride(item.stageDetails.id, item.roundedBags + 1)} className="print:hidden w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-black">+</button>
                                        </div>
                                    </td>
                                </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-end mt-4">
                      <div className="flex items-center gap-4 bg-slate-900 text-white print:bg-white print:text-slate-900 print:border print:border-slate-300 print:shadow-none px-5 py-3 rounded-xl shadow-md">
                          <span className="text-[10px] font-black uppercase text-slate-400 print:text-slate-600">Total Factura</span>
                          <span className="font-black text-xl font-mono tracking-tight">{formatCurrency(orderSummary.grandTotalCost)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><MapPin size={14} className="text-emerald-500"/> Distribución por Lote</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {processedCorrals.map(c => (
                        <div key={c.id} className="border border-slate-200 p-4 rounded-2xl bg-slate-50/50 print:bg-white flex flex-col justify-between">
                            <div className="mb-2 border-b pb-2">
                                <p className="font-black text-xs uppercase text-slate-900">{c.name}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{c.summaryText}</p>
                            </div>
                            <div className="space-y-1">
                                {c.items.map((it, i) => (
                                    <div key={i} className="flex justify-between items-center">
                                        <span className="text-[8px] font-bold uppercase text-slate-500 truncate w-32">{it.stageDetails.stage}</span>
                                        <span className="text-sm font-black text-emerald-700 print:text-slate-900">{formatNumber(it.calculatedBags)} scs</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-16 pt-8 border-t border-slate-100 grid grid-cols-3 gap-10 text-center">
                    <div>
                        <div className="border-b border-slate-400 h-6 w-32 mx-auto"></div>
                        <p className="text-[8px] font-black uppercase text-slate-800 mt-2">Firma Solicitante</p>
                    </div>
                    <div>
                        <div className="border-b border-slate-400 h-6 w-32 mx-auto"></div>
                        <p className="text-[8px] font-black uppercase text-slate-800 mt-2">Autorización</p>
                    </div>
                    <div>
                        <div className="border-b border-slate-400 h-6 w-32 mx-auto"></div>
                        <p className="text-[8px] font-black uppercase text-slate-800 mt-2">Recibe Bodega</p>
                    </div>
                </div>
              </section>

              <button 
                onClick={handleFinalizePurchase}
                className="print:hidden bg-slate-900 text-white px-10 py-4 rounded-full font-black text-sm shadow-2xl hover:bg-black transition-all flex items-center gap-3 active:scale-95"
              >
                  <ShoppingCart size={20}/> FINALIZAR Y GUARDAR COMPRA
              </button>
            </div>
          </>
        )}

        {/* MODAL MODO DIOS (Editar Historial) */}
        {editingCorralHistory && (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 print:hidden animate-in fade-in">
                <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
                    <div className="bg-slate-50 px-6 py-4 border-b flex justify-between items-center">
                        <div>
                            <h3 className="font-black text-slate-900">Ajuste de Historial</h3>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-600">Sincronización Física</p>
                        </div>
                        <button onClick={() => setEditingCorralHistory(null)} className="text-slate-400 hover:text-slate-700 bg-white p-1 rounded-full shadow-sm border"><X size={18}/></button>
                    </div>
                    <div className="p-6">
                        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                            Ingresa la cantidad <strong>exacta de sacos</strong> que este lote ya ha consumido en la granja. El motor matemático se sincronizará a partir de estos datos.
                        </p>
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                            {feedData.map(feed => (
                                <div key={feed.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="w-2/3">
                                        <p className="text-[10px] font-black uppercase text-slate-700">{feed.stage}</p>
                                        <p className="text-[9px] text-slate-400 font-bold">{feed.bagSize} lbs / saco</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={tempHistoryBags[feed.id] || ''} 
                                            onChange={(e) => setTempHistoryBags({...tempHistoryBags, [feed.id]: e.target.value})}
                                            className="w-16 text-center font-black bg-white border border-slate-200 rounded-lg py-1.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                                            placeholder="0"
                                        />
                                        <span className="text-[9px] font-black text-slate-400 uppercase">scs</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3">
                        <button onClick={() => setEditingCorralHistory(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                        <button onClick={saveHistoryModal} className="px-6 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm transition-all active:scale-95">Guardar Historial</button>
                    </div>
                </div>
            </div>
        )}

      </main>
    </div>
  );
}