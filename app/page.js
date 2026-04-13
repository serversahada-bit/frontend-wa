"use client";

import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import {
  Smartphone, Send, Clock, CheckCircle2, XCircle, Loader2,
  Image as ImageIcon, X, MessageSquare, Database, Settings,
  Plus, Trash2, ShieldCheck, AlertCircle, RefreshCcw, Bell, Grid, ChevronDown, Bot, FileSpreadsheet, Link2, Users, UserPlus, CornerDownRight
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ✅ REVISI: Menggunakan HTTPS dan .env agar tidak error di Coolify
const getSocketUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || 'https://apiwa.ptslu.cloud';
};

const DEFAULT_MSG = `Halo Kak 👋\n\nKenalin, *Gamamilk* 🥛\nSusu etawa pilihan keluarga.`;

const CustomAccountDropdown = ({ options, activeId, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative w-full">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}></div>}
      <div onClick={() => setOpen(!open)} className={`font-bold text-slate-800 cursor-pointer flex items-center justify-between w-full relative z-40 p-1 -m-1 rounded-lg hover:bg-slate-50 transition`}>
        <span className="truncate pr-4 text-[13px] tracking-wide">{activeId || "Pilih Akun..."}</span>
        {options.length > 0 && <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />}
      </div>
      {open && (
        <div className={`absolute top-full left-0 mt-3 w-[260px] bg-white border border-slate-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] rounded-2xl z-50 overflow-hidden animate-in zoom-in-95 fade-in duration-200`}>
          {options.length === 0 ? (
            <div className="p-4 text-xs font-medium text-slate-400 text-center">Belum ada perangkat terhubung.</div>
          ) : options.map(o => {
            const isSel = activeId === o.sessionId;
            return (
              <div key={o.sessionId} onClick={() => { onChange(o.sessionId); setOpen(false); }} className={`px-4 py-3 cursor-pointer flex items-center gap-3 border-b border-slate-50 last:border-0 transition-colors ${isSel ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSel ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                  <Smartphone size={14} />
                </div>
                <div className="flex flex-col">
                  <span className={`text-[13px] font-bold ${isSel ? 'text-indigo-700' : 'text-slate-700'}`}>{o.sessionId}</span>
                </div>
                {isSel && <CheckCircle2 size={16} className={`text-indigo-500 ml-auto`} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
};

export default function Home() {
  const [activeMenu, setActiveMenu] = useState('devices'); // 'devices' | 'blast' | 'chat'

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState('');

  // Modals
  const [isAddDeviceModal, setIsAddDeviceModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');

  // UI Isolations for Blast Form
  const [forms, setForms] = useState({});

  // Global State
  const [progressLog, setProgressLog] = useState([]);
  const [inbox, setInbox] = useState([]);

  // Chat Room 1on1 State
  const [activeChat, setActiveChat] = useState(null); // { sessionId, senderNumber, senderName }
  const [chatHistory, setChatHistory] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Contacts (Buku Telepon) State
  const [dbContacts, setDbContacts] = useState([]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactNumber, setNewContactNumber] = useState('');
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [sheetLink, setSheetLink] = useState('');
  const [isImportingSheet, setIsImportingSheet] = useState(false);

  const loadDbContacts = async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`${getSocketUrl()}/api/contacts/${activeSessionId}`);
      setDbContacts(await res.json());
    } catch (e) { }
  };

  useEffect(() => {
    if (activeMenu === 'contacts') loadDbContacts();
  }, [activeMenu, activeSessionId]);

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactNumber.trim()) return alert('Mohon isi nama dan nomor Whatsapp!');
    setIsSavingContact(true);
    try {
      const res = await fetch(`${getSocketUrl()}/api/contacts/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId, contacts: { name: newContactName, number: newContactNumber } })
      });
      if (res.ok) {
        setNewContactName('');
        setNewContactNumber('');
        loadDbContacts();
      } else alert((await res.json()).error);
    } catch (e) { }
    setIsSavingContact(false);
  };

  const handleImportSheet = async () => {
    if (!activeSessionId) return alert("Pilih perangkat dulu pada dropdown di atas!");
    if (!sheetLink.trim()) return alert("Masukkan link Google Sheets!");

    // Extract ID (e.g. /d/1XyZ.../edit)
    const match = sheetLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return alert("Link Google Sheets tidak valid. Harus mengandung format '/d/ID_DOKUMEN'");
    const docId = match[1];

    let gid = '0';
    const gidMatch = sheetLink.match(/[#&]gid=([0-9]+)/);
    if (gidMatch) gid = gidMatch[1];

    setIsImportingSheet(true);
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gid}`;
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error("Gagal mengambil data. Pastikan Sheet Anda memiliki akses 'Anyone with the link can view'.");
      const csvText = await res.text();

      const rows = csvText.split('\n').map(r => r.trim()).filter(r => r);
      let parsedContacts = [];

      // Basic CSV heuristic parsing
      // Looking for a numeric-only column that starts with 62 or 08
      for (const row of rows) {
        // Handle basic commas
        const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        let name = '';
        let number = '';

        for (const col of cols) {
          const clean = String(col).replace(/[-\s+]/g, '');
          if (clean.match(/^(62|08)[0-9]{8,15}$/) && !number) {
            number = clean;
          } else if (!name && isNaN(Number(col.charAt(0)))) {
            // set target name to first column that doesn't start with a number
            name = col;
          }
        }
        if (number) {
          parsedContacts.push({ name: name || number, number });
        }
      }

      if (parsedContacts.length === 0) {
        setIsImportingSheet(false);
        return alert("Tidak ada data nomor WhatsApp valid yang ditemukan di file Sheet tersebut.");
      }

      // POST to backend
      const pushRes = await fetch(`${getSocketUrl()}/api/contacts/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId, contacts: parsedContacts })
      });
      if (pushRes.ok) {
        alert(`🎉 BERHASIL! Sebanyak ${parsedContacts.length} kontak diimpor ke Database.`);
        setSheetLink('');
        loadDbContacts();
      } else {
        alert((await pushRes.json()).error);
      }
    } catch (err) {
      alert(err.message || "Gagal mengimpor Spreadsheet");
    }
    setIsImportingSheet(false);
  };

  const handleDeleteContact = async (id) => {
    if (!confirm('Hapus kontak ini permanen dari database?')) return;
    try {
      await fetch(`${getSocketUrl()}/api/contacts/delete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      loadDbContacts();
    } catch (e) { }
  };

  const loadContactsIntoblast = async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`${getSocketUrl()}/api/contacts/${activeSessionId}`);
      const data = await res.json();
      if (data.length === 0) return alert('Buku telepon untuk akun ini masih kosong.');

      const currentF = getForm();
      const existing = currentF.numbers.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== '');
      const allNumbers = data.map(c => c.contact_number);
      const combined = [...new Set([...existing, ...allNumbers])];

      updateForm('numbers', combined.join('\n'));
      alert(`✨ BERHASIL: Menyuntikkan ${allNumbers.length} nomor dari Database!`);
    } catch (e) { }
  };

  // Chatbot Auto-Responder State
  const [autoReplies, setAutoReplies] = useState([]);
  const [botForm, setBotForm] = useState({ keyword: '', response: '', isExact: true });
  const [isSavingBot, setIsSavingBot] = useState(false);

  const progressEndRef = useRef(null);
  const chatEndRef = useRef(null);
  const excelUploadRef = useRef(null);

  useEffect(() => {
    const socketUrl = getSocketUrl();
    const socket = io(socketUrl);

    socket.on('init_sessions', (data) => {
      setSessions(data);
      if (data.length > 0 && !activeSessionId) setActiveSessionId(data[0].sessionId);
    });

    socket.on('init_inbox', (dbData) => {
      setInbox(dbData.reverse());
    });

    socket.on('session_created', (data) => {
      setSessions(prev => {
        if (!prev.find(s => s.sessionId === data.sessionId)) return [...prev, data];
        return prev;
      });
      setActiveSessionId(data.sessionId);
    });

    socket.on('session_deleted', (data) => {
      setSessions(prev => {
        const next = prev.filter(s => s.sessionId !== data.sessionId);
        if (activeSessionId === data.sessionId && next.length > 0) setActiveSessionId(next[0].sessionId);
        else if (next.length === 0) setActiveSessionId('');
        return next;
      });
    });

    socket.on('wa_status', ({ sessionId, status }) => {
      setSessions(prev => prev.map(s => s.sessionId === sessionId ? { ...s, status, qr: status === 'Ready' || status === 'Authenticated' ? null : s.qr } : s));
    });

    socket.on('wa_qr', ({ sessionId, qr }) => {
      setSessions(prev => prev.map(s => s.sessionId === sessionId ? { ...s, qr } : s));
    });

    socket.on('wa_message', (msg) => {
      setInbox(prev => [msg, ...prev]);
      // Jika panel chat untuk nomor ini sedang terbuka, langsung tambahkan text ke Bubble
      setChatHistory(prev => {
        // Cek apakah chat yg kebuka adalah chat dgn orang yg barusan nulis ini
        // (Kita mengandalkan closure react yg mungkin tidak terupdate, tapi setState function form selalu memiliki prev text terbaru)
        return [...prev, msg]; // Kita saring saat dirender saja atau kita push. Kita push saja. Saat dirender, kita bisa menfilter.
      });
    });

    socket.on('chat_reply', (msg) => {
      setChatHistory(prev => [...prev, msg]);
      // Update juga di panel kiri agar naik ke atas
      setInbox(prev => [msg, ...prev]);
    });

    // Logging & Blast Status
    socket.on('blast_start', (data) => {
      setForms(prev => ({ ...prev, [data.sessionId]: { ...(prev[data.sessionId] || {}), isBlasting: true } }));
      setProgressLog(prev => [...prev, { type: 'info', text: `[${data.sessionId}] 🚀 Memulai blast ke ${data.total} kontak...` }]);
    });

    socket.on('blast_progress', (data) => {
      setProgressLog(prev => [...prev, {
        type: data.status.includes('Berhasil') ? 'success' : 'error',
        text: `[${data.sessionId}] [${data.index}/${data.total}] ${data.number} - ${data.status}`
      }]);
    });

    socket.on('blast_wait', (data) => {
      setProgressLog(prev => [...prev, { type: 'wait', text: `[${data.sessionId}] Delay anti-blokir (${data.ms / 1000}d)...` }]);
    });

    socket.on('blast_finished', (data) => {
      setForms(prev => ({ ...prev, [data.sessionId]: { ...(prev[data.sessionId] || {}), isBlasting: false } }));
      setProgressLog(prev => [...prev, { type: 'success', text: `[${data.sessionId}] ✅ Blast rampung!` }]);
    });

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeMenu === 'blast') progressEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (activeMenu === 'autoreply') loadAutoReplies();
  }, [progressLog, activeMenu]);

  useEffect(() => {
    if (activeChat) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, activeChat]);

  // Form Management Helpers
  const getForm = () => forms[activeSessionId] || { numbers: '', message: DEFAULT_MSG, media: null, previewUrl: '', isBlasting: false };
  const updateForm = (key, value) => {
    if (!activeSessionId) return;
    setForms(prev => ({
      ...prev, [activeSessionId]: { ...(prev[activeSessionId] || { numbers: '', message: DEFAULT_MSG, media: null, previewUrl: '', isBlasting: false }), [key]: value }
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) { alert("Maks 15 MB."); e.target.value = ''; return; }
      const preview = URL.createObjectURL(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        updateForm('previewUrl', preview);
        updateForm('media', { mimetype: file.type, filename: file.name, data: reader.result.split(',')[1] });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !activeSessionId) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        let allNumbers = [];

        wb.SheetNames.forEach(sheetName => {
          const sheet = wb.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          rawData.forEach(row => {
            row.forEach(cell => {
              if (cell) {
                const strCell = String(cell).replace(/[-\s+]/g, ''); // Hapus spasi/strip
                // Validasi sederhana: dimulai dengan 62 atau 08
                if (strCell.match(/^(62|08)[0-9]{8,15}$/)) {
                  allNumbers.push(strCell);
                }
              }
            });
          });
        });

        if (allNumbers.length > 0) {
          const currentF = getForm();
          const existing = currentF.numbers.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== '');
          const combined = [...new Set([...existing, ...allNumbers])]; // Hilangkan duplikat

          updateForm('numbers', combined.join('\n'));
          alert(`✨ BERHASIL: Menarik ${allNumbers.length} nomor WhatsApp dari file Excel Anda!`);
        } else {
          alert("Gagal: Kolom dengan teks berawalan 08 atau 62 tidak ditemukan di dalam Excel ini.");
        }
      } catch (err) { alert("Format Excel tidak sah."); }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const handleGoogleSheetsImport = async () => {
    if (!activeSessionId) return;
    const url = prompt("Masukkan Link Google Sheets Anda:\n(Pastikan opsi berbagi sudah diubah menjadi 'Anyone with the link' / 'Siapa saja yang menaut').");
    if (!url) return;

    try {
      const res = await fetch(`${getSocketUrl()}/api/import-sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();

      if (data.success) {
        const currentF = getForm();
        const existing = currentF.numbers.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== '');
        const combined = [...new Set([...existing, ...data.numbers])];
        updateForm('numbers', combined.join('\n'));
        alert(`✨ BERHASIL: Memanen ${data.count} nomor WA unik langsung dari Google Sheets!`);
      } else {
        alert("X GAGAL: " + data.error);
      }
    } catch (err) { alert("X GAGAL: Koneksi ke server perantara terputus."); }
  };

  const removeMedia = () => {
    updateForm('media', null);
    updateForm('previewUrl', '');
    const fi = document.getElementById('imageUpload');
    if (fi) fi.value = '';
  };

  // API Callers
  const handleCreateSession = () => {
    setIsAddDeviceModal(true);
    setNewDeviceName('');
  };

  const submitCreateSession = async () => {
    if (!newDeviceName?.trim()) return;
    try {
      const res = await fetch(`${getSocketUrl()}/api/sessions/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: newDeviceName.trim() })
      });
      if (!res.ok) alert((await res.json()).error);
      else {
        setIsAddDeviceModal(false);
        setNewDeviceName('');
      }
    } catch (err) { alert("Server backend terputus."); }
  };

  const handleDeleteSession = async (id) => {
    if (!confirm(`HAPUS PERMANEN akun "${id}" dan Logout perangkat?`)) return;
    await fetch(`${getSocketUrl()}/api/sessions/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: id }) });
  };

  const handleLogoutSession = async (id) => {
    if (!confirm(`Putuskan/Logout spesifik dari WA perangkat "${id}"?`)) return;
    await fetch(`${getSocketUrl()}/api/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: id }) });
  };

  const handleStartBlast = async () => {
    if (!activeSessionId) return alert("Pilih Tab/Sesi WA terlebih dahulu!");
    const f = getForm();
    if (!f.numbers.trim()) return alert("Daftar nomor harus diisi!");
    if (!f.message.trim() && !f.media) return alert("Teks promosi tidak boleh kosong jika tanpa gambar.");

    const parsedNumbers = f.numbers.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== '');

    try {
      const res = await fetch(`${getSocketUrl()}/api/blast`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId, numbers: parsedNumbers, message: f.message.trim() ? f.message : '', media: f.media })
      });
      if (!res.ok) alert((await res.json()).error);
    } catch (err) { alert("Server backend terputus saat request blast."); }
  };

  const openChatRoom = async (sessionId, senderNumber, senderName) => {
    setActiveChat({ sessionId, senderNumber, senderName });
    setChatHistory([]); // reset saat loading
    try {
      const res = await fetch(`${getSocketUrl()}/api/chat/history`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, senderNumber })
      });
      const data = await res.json();
      setChatHistory(data);
    } catch (err) { console.error("Gagal memuat histori chat"); }
  };

  const closeChatRoom = () => setActiveChat(null);

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeChat) return;
    setIsSendingReply(true);
    try {
      const res = await fetch(`${getSocketUrl()}/api/chat/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeChat.sessionId, targetNumber: activeChat.senderNumber, message: replyText.trim() })
      });
      if (res.ok) {
        setReplyText('');
      } else {
        alert((await res.json()).error);
      }
    } catch (err) {
      alert("Gagal mengirim balasan.");
    } finally {
      setIsSendingReply(false);
    }
  };

  const loadAutoReplies = async () => {
    try {
      const res = await fetch(`${getSocketUrl()}/api/autoreply/list`);
      const data = await res.json();
      setAutoReplies(data);
    } catch (e) { }
  };

  const handleSaveBotRule = async () => {
    if (!botForm.keyword.trim() || !botForm.response.trim()) return alert("Isi Keyword dan Balasan Teks!");
    setIsSavingBot(true);
    try {
      const res = await fetch(`${getSocketUrl()}/api/autoreply/add`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(botForm)
      });
      if (res.ok) {
        setBotForm({ keyword: '', response: '', isExact: true });
        loadAutoReplies();
      } else {
        alert((await res.json()).error);
      }
    } catch (e) { alert("Koneksi gagal"); }
    setIsSavingBot(false);
  };

  const handleDeleteBotRule = async (id) => {
    if (!confirm("Hapus aturan chatbot ini?")) return;
    try {
      await fetch(`${getSocketUrl()}/api/autoreply/delete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      loadAutoReplies();
    } catch (e) { }
  };


  // --- VIEW RENDERERS ---

  const renderScreenDevices = () => (
    <div className="p-6 md:p-10 w-full animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manajemen Perangkat WhatsApp</h2>
          <p className="text-slate-500 mt-1 flex items-center gap-2"><Smartphone size={16} /> {sessions.length} Akun saling terhubung dan tersimpan permanen di Database.</p>
        </div>
        <button onClick={handleCreateSession} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5">
          <Plus size={18} /> Tambah Nomor Baru
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sessions.map(s => {
          const isReady = s.status === 'Ready' || s.status === 'Authenticated';
          const isError = s.status.toLowerCase().includes('fail') || s.status.toLowerCase().includes('error');
          return (
            <div key={s.sessionId} className="bg-white border text-center border-slate-200 rounded-2xl shadow-sm flex flex-col p-6 relative overflow-hidden group">
              {/* TOP STATUS */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3 text-left">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isReady ? 'bg-emerald-50 text-emerald-600' : isError ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                    <Smartphone size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-[15px] truncate max-w-[120px]">{s.sessionId}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="relative flex h-2 w-2">
                        {isReady ? <span className="absolute h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span> : null}
                        <span className={`relative rounded-full h-2 w-2 ${isReady ? 'bg-emerald-500' : isError ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                      </span>
                      <p className={`text-[11px] font-bold tracking-wide uppercase ${isReady ? 'text-emerald-600' : isError ? 'text-red-500' : 'text-amber-500'}`}>{s.status}</p>
                    </div>
                  </div>
                </div>
                {/* TOOLBAR */}
                <div className="flex gap-1.5 shrink-0 bg-slate-50 p-1 rounded-xl border border-slate-100 shadow-inner">
                  {isReady && <button onClick={() => handleLogoutSession(s.sessionId)} className="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-colors border border-transparent hover:border-amber-200" title="Keluar / Disconnect"><RefreshCcw size={16} /></button>}
                  <button onClick={() => handleDeleteSession(s.sessionId)} className="p-2 text-red-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-transparent hover:border-red-200" title="Hapus Akun Permanen"><Trash2 size={16} /></button>
                </div>
              </div>

              {/* CARD BODY (QR OR READY) */}
              <div className="flex-1 flex flex-col items-center justify-center py-2">
                {isReady ? (
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border-4 border-emerald-100"><ShieldCheck size={36} className="text-emerald-500" /></div>
                    <p className="font-semibold text-emerald-600 text-[13px] uppercase tracking-wide">Perangkat Berhasil Tertaut</p>
                    <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">Nomor WA ini siap digunakan untuk Broadcast kapanpun.</p>
                  </div>
                ) : s.qr ? (
                  <div className="flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
                    <div className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-md">
                      <QRCodeSVG value={s.qr} size={150} />
                    </div>
                    <p className="text-xs font-semibold text-amber-600 mt-4 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Menunggu HP Anda...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <Loader2 size={36} className="animate-spin text-slate-300 mb-3" />
                    <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Menghubungi Node...</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div onClick={handleCreateSession} className="border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/50 rounded-2xl h-[340px] flex flex-col items-center justify-center cursor-pointer transition text-slate-400 hover:text-blue-500">
            <Plus size={48} className="mb-4" />
            <p className="font-bold text-lg">Buat Perangkat Pertama</p>
            <p className="text-sm mt-1">Daftarkan nomor WhatsApp Web Anda</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderScreenBlast = () => {
    const currentF = getForm();
    const activeData = sessions.find(s => s.sessionId === activeSessionId);
    return (
      <div className="flex-1 p-6 md:p-8 h-full animate-in fade-in duration-300 flex gap-6">

        {/* KIRI: PANEL FORM */}
        <div className="w-[500px] flex flex-col shrink-0 h-full">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Send size={24} className="text-blue-600" /> Broadcast Kampanye</h2>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col h-full relative overflow-y-auto scrollbar-thin">

            <div className="mb-6 group">
              <label className="text-sm font-bold text-slate-700 mb-2 block">Pilih Akun Pengirim (Tersedia: {sessions.filter(s => s.status === 'Ready' || s.status === 'Authenticated').length})</label>
              <div className="flex gap-2 w-full overflow-x-auto pb-1 scrollbar-thin">
                {sessions.map(s => {
                  const isActive = s.sessionId === activeSessionId;
                  const isR = s.status === 'Ready' || s.status === 'Authenticated';
                  return (
                    <button key={s.sessionId} onClick={() => setActiveSessionId(s.sessionId)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${isActive ? 'bg-blue-600 border border-blue-600 shadow-md text-white' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                      {s.sessionId}
                      {isR ? <CheckCircle2 size={14} className={isActive ? 'text-white' : 'text-emerald-500'} /> : <AlertCircle size={14} className={isActive ? 'text-amber-200' : 'text-amber-500'} />}
                    </button>
                  )
                })}
              </div>
            </div>

            {(!activeData || (activeData.status !== 'Ready' && activeData.status !== 'Authenticated')) ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-amber-200 rounded-2xl bg-amber-50 text-amber-600">
                <AlertCircle size={40} className="mb-4 opacity-50" />
                <p className="font-bold text-sm">Akun WhatsApp Belum Siap</p>
                <p className="text-xs mt-2 opacity-80">Pastikan perangkat Anda sudah sukses terhubung di menu Devices sebelum menembak Kampanye.</p>
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                {/* Media */}
                <div className="mb-5">
                  <label className="text-sm font-bold text-slate-700 mb-2 block">Gambar Penawaran</label>
                  {!currentF.previewUrl ? (
                    <div className="relative w-full h-20 bg-slate-50 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl flex items-center justify-center transition-all cursor-pointer">
                      <ImageIcon size={20} className="text-slate-400 mr-2" />
                      <span className="text-xs text-slate-500 font-medium">Klik untuk upload lampiran...</span>
                      <input type="file" id="imageUpload" accept="image/png, image/jpeg" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} disabled={currentF.isBlasting} />
                    </div>
                  ) : (
                    <div className="flex items-center p-3 gap-3 rounded-xl border border-blue-100 bg-blue-50/50">
                      <img src={currentF.previewUrl} alt="Preview" className="w-12 h-12 object-cover rounded-md border border-slate-200 bg-white" />
                      <div className="flex-1 overflow-hidden"><p className="text-xs font-bold text-slate-700 truncate">{currentF.media?.filename}</p></div>
                      <button onClick={removeMedia} className="p-1.5 bg-white text-slate-400 hover:text-red-500 rounded-lg shadow-sm border"><X size={14} /></button>
                    </div>
                  )}
                </div>

                {/* File Upload Hidden */}
                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} ref={excelUploadRef} className="hidden" />

                {/* Target Contact Box with Import Excel Button */}
                <div className="mb-5 flex-1 flex flex-col min-h-[150px]">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-slate-700">Target Nomor WhatsApp</label>
                    <div className="flex items-center gap-2">
                      <button onClick={loadContactsIntoblast} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 rounded-lg text-xs font-bold transition shadow-sm border border-indigo-100">
                        <Users size={14} /> Buku Telepon
                      </button>
                      <button onClick={handleGoogleSheetsImport} className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800 rounded-lg text-xs font-bold transition shadow-sm border border-sky-100">
                        <Link2 size={14} className="-rotate-45" /> Google Sheets
                      </button>
                      <button onClick={() => excelUploadRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 rounded-lg text-xs font-bold transition shadow-sm border border-emerald-100">
                        <FileSpreadsheet size={14} /> Import Excel
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={currentF.numbers}
                    onChange={e => updateForm('numbers', e.target.value)}
                    disabled={currentF.isBlasting}
                    placeholder="Contoh:&#10;08123456789&#10;628987654321&#10;&#10;Atau klik tombol Import Data Excel di atas..."
                    className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-mono text-slate-700 focus:border-blue-500 focus:bg-white outline-none resize-none shadow-inner"
                  />
                  <span className="text-xs text-slate-400 mt-2 flex items-center gap-1"><AlertCircle size={12} /> Tiap baris baru dihitung 1 nomor WA target.</span>
                </div>

                {/* Teks Promosi */}
                <div className="mb-6 flex-1 flex flex-col">
                  <label className="text-sm font-bold text-slate-700 mb-2 block">Caption WhatsApp</label>
                  <textarea value={currentF.message} onChange={(e) => updateForm('message', e.target.value)} disabled={currentF.isBlasting} className="w-full flex-1 min-h-[120px] bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 focus:border-blue-500 outline-none leading-relaxed transition resize-none"></textarea>
                </div>

                <button onClick={handleStartBlast} disabled={currentF.isBlasting} className="w-full mt-auto py-3.5 bg-neutral-900 hover:bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:bg-slate-200 disabled:text-slate-400 transition-all">
                  {currentF.isBlasting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  <span>{currentF.isBlasting ? `Pengiriman Sedang Berjalan...` : `EKSEKUSI BROADCAST [${activeSessionId}]`}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* KANAN: LIVE TERMINAL */}
        <div className="flex-1 bg-neutral-950 rounded-2xl shadow-xl flex flex-col overflow-hidden border border-neutral-900 h-full">
          <div className="h-12 bg-neutral-900 border-b border-black flex items-center px-4 shrink-0">
            <Clock size={16} className="text-emerald-500 mr-2" />
            <h3 className="text-slate-300 font-bold text-sm">Server Blast Terminal (Multi-Thread)</h3>
            <span className="ml-auto flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="p-5 font-mono text-[13px] leading-relaxed overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-neutral-700">
            {progressLog.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-600">
                <Database size={40} className="mb-4 opacity-30 text-emerald-500" />
                <p>Mesin Blast MySQL siap menerima perintah.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pb-4">
                {progressLog.map((log, i) => (
                  <div key={i} className={`flex items-start gap-3 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : log.type === 'info' ? 'text-sky-400 font-bold' : 'text-amber-400'}`}>
                    <div className="mt-0.5 shrink-0 opacity-80">
                      {log.type === 'error' && <XCircle size={14} />}
                      {log.type === 'success' && <CheckCircle2 size={14} />}
                      {log.type === 'info' && <span>&gt;</span>}
                      {log.type === 'wait' && <Loader2 size={14} className="animate-spin" />}
                    </div>
                    <span className="break-all tracking-wide">{log.text}</span>
                  </div>
                ))}
                <div ref={progressEndRef} className="h-2" />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  };

  const renderScreenChat = () => (
    <div className="flex-1 bg-white mx-6 my-6 border border-slate-200 rounded-2xl shadow-sm flex h-[calc(100vh-100px)] animate-in fade-in duration-300 overflow-hidden relative">

      {/* KIRI: LIST INBOX (Lebar fixed di Desktop) */}
      <div className={`${activeChat ? 'hidden md:flex w-[350px]' : 'flex w-full md:w-[350px]'} border-r border-slate-200 flex-col h-full bg-slate-50 transition-all shrink-0`}>
        <div className="h-16 border-b border-slate-200 flex items-center justify-between px-5 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center"><MessageSquare size={20} /></div>
            <div>
              <h2 className="text-slate-800 font-bold text-[15px]">Konsol CS</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Target: {inbox.length} Antrean</p>
            </div>
          </div>
          {/* Hanya nampak saat panel full */}
          {!activeChat && (
            <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 shadow-sm">
              MySQL Sync
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 bg-slate-50">
          {inbox.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <Database size={40} className="mb-4 opacity-20 text-indigo-400" />
              <p className="font-sans font-bold text-slate-600 text-sm">Database Inbox Kosong</p>
              <p className="text-xs mt-1">Pesan pelanggan ke WhatsApp Anda (di menu Devices) otomatis akan terangkum di sini.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {Object.values(inbox.reduce((acc, msg) => {
                const key = `${msg.sessionId}_${msg.from}`;
                if (!acc[key]) acc[key] = msg;
                return acc;
              }, {})).map((msg, idx) => {
                const fromNum = (msg.from || '').split('@')[0];
                const isActiveCard = activeChat?.senderNumber === msg.from && activeChat?.sessionId === msg.sessionId;
                return (
                  <div key={idx} onClick={() => openChatRoom(msg.sessionId, msg.from, msg.senderName)} className={`border-b border-slate-100 p-4 transition-all cursor-pointer group flex flex-col relative ${isActiveCard ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'bg-white hover:bg-slate-50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 overflow-hidden pr-2">
                        <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                          {msg.senderName?.substring(0, 2) || 'WA'}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className={`text-[13px] font-bold truncate ${isActiveCard ? 'text-indigo-800' : 'text-slate-800'}`}>{msg.senderName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{fromNum}</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap mt-1">{msg.timestamp || 'Today'}</span>
                    </div>

                    <p className={`text-[12px] leading-relaxed break-words line-clamp-2 ${isActiveCard ? 'text-indigo-700/80 font-medium' : 'text-slate-600'}`}>
                      {msg.isOutgoing ? <span className="text-emerald-500 mr-1">Anda:</span> : null}
                      {msg.body}
                    </p>

                    {!isActiveCard && (
                      <div className="mt-2 pt-2 border-t border-slate-100/50 flex items-center gap-1.5 opacity-60 group-hover:opacity-100">
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest">{msg.sessionId}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* KANAN: RUANG CHAT 1-ON-1 */}
      {activeChat ? (
        <div className="flex-1 flex flex-col bg-[#efeae2] relative animate-in slide-in-from-right-8 duration-300">
          {/* Header Chat */}
          <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-5 shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-3">
              <button onClick={closeChatRoom} className="md:hidden p-2 -ml-2 text-slate-500"><X size={20} /></button>
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold uppercase">{activeChat.senderName.substring(0, 2)}</div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-800 text-[15px]">{activeChat.senderName}</span>
                <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                  <Smartphone size={10} /> Diterima di: {activeChat.sessionId}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-slate-200"><Settings size={16} /></button>
            </div>
          </div>

          {/* Bubble Area */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-[url('https://web.whatsapp.com/img/bg-chat-tile-light_04fcacde539c58cca6745483d4858c52.png')] bg-repeat bg-[length:400px_auto] bg-opacity-50 opacity-90 pb-32">
            <div className="text-center my-2">
              <span className="bg-[#e1f3fb] text-[#47606e] text-[11px] px-3 py-1 rounded-lg font-bold shadow-sm">Percakapan ini disimpan permanen dan aman di Database.</span>
            </div>
            {chatHistory.filter(h => h.from === activeChat.senderNumber && h.sessionId === activeChat.sessionId).map((h, i) => (
              <div key={i} className={`flex ${h.isOutgoing ? 'justify-end' : 'justify-start'} mb-1`}>
                <div className={`max-w-[70%] sm:max-w-[60%] rounded-2xl p-3 shadow-[0_1px_0.5px_rgba(11,20,26,.13)] flex flex-col relative ${h.isOutgoing ? 'bg-[#d9fdd3] text-[#111B21] rounded-tr-sm' : 'bg-white text-[#111B21] rounded-tl-sm'}`}>
                  <span className="text-[14px] leading-relaxed whitespace-pre-wrap word-break">{h.body}</span>
                  <div className="text-[10px] text-slate-500 font-semibold mt-1 text-right flex justify-end items-center gap-1">
                    {h.timestamp}
                    {h.isOutgoing && <CheckCircle2 size={12} className="text-blue-500" />}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input Balasan Bawah */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-[#f0f2f5] border-t border-slate-200 flex items-end gap-3 z-20">
            <button className="p-3 text-slate-500 hover:text-slate-700 transition"><ImageIcon size={22} /></button>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Ketik balasan untuk pelanggan..."
              className="flex-1 max-h-[150px] min-h-[44px] bg-white rounded-xl border-none outline-none py-3 px-4 text-[14px] shadow-sm resize-none"
              rows={1}
              disabled={isSendingReply}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); }
              }}
            />
            <button
              onClick={handleSendReply}
              disabled={isSendingReply || !replyText.trim()}
              className="p-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-full transition shadow-md shrink-0 focus:scale-95">
              {isSendingReply ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
            </button>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 bg-slate-50/80 items-center justify-center">
          <div className="text-center flex flex-col items-center">
            <Database size={80} className="text-slate-300 mb-6" />
            <h3 className="text-xl font-bold text-slate-700">Enterprise Web Chat</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-sm">Pilih percakapan dari sebelah kiri untuk mulai membalas pesan. Semua balasan via Dashboard terekam ke XAMPP lokal.</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderScreenBot = () => (
    <div className="flex-1 p-6 md:p-8 h-full animate-in fade-in duration-300 flex flex-col lg:flex-row gap-6">

      {/* KIRI: PANEL BUAT ATURAN & INFO */}
      <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col shrink-0 h-full overflow-y-auto pr-2 scrollbar-thin gap-6">

        {/* Title */}
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            <span className="bg-gradient-to-tr from-indigo-500 to-purple-500 text-white p-2.5 rounded-2xl shadow-lg shadow-indigo-500/30">
              <Bot size={24} />
            </span>
            Auto Responder
          </h2>
          <p className="text-slate-500 mt-2 text-sm font-medium leading-relaxed">Buat mesin pembalas otomatis. Jika pelanggan mengetik angka atau kata kunci, sistem akan otomatis merespon.</p>
        </div>

        {/* Form Tambah */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-2"><Plus size={20} className="text-indigo-500" /> Buat Aturan Baru</h3>

          <div className="flex flex-col mb-4 relative group/input">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Trigger / Kata Kunci</label>
            <input type="text" value={botForm.keyword} onChange={e => setBotForm({ ...botForm, keyword: e.target.value })} placeholder="Contoh: 1, INFO, BELI" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-bold text-indigo-700 transition-all shadow-inner" />
          </div>

          <div className="flex flex-col mb-4 relative group/input">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Algoritma Pencocokan</label>
            <select value={botForm.isExact} onChange={e => setBotForm({ ...botForm, isExact: e.target.value === 'true' })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-semibold transition-all cursor-pointer shadow-inner appearance-none">
              <option value="true">Sama Persis (Exact Match)</option>
              <option value="false">Mengandung Kata (Contains)</option>
            </select>
          </div>

          <div className="flex flex-col mb-8 relative group/input">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Balasan Otomatis</label>
            <textarea value={botForm.response} onChange={e => setBotForm({ ...botForm, response: e.target.value })} placeholder="Ketik teks yang akan dikirim secara otomatis ke pelanggan..." rows={5} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all resize-none shadow-inner leading-relaxed" />
          </div>

          <button onClick={handleSaveBotRule} disabled={isSavingBot} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0">
            {isSavingBot ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />} Simpan Mesin Bot
          </button>
        </div>

        {/* Tip Box */}
        <div className="bg-indigo-50 text-indigo-700 p-6 rounded-3xl border border-indigo-100 text-[13px] font-medium leading-relaxed shadow-sm shrink-0 mt-auto">
          <AlertCircle size={18} className="inline mr-2 -mt-1" />
          <span className="font-bold">Tips:</span> Jika Anda menyetting Trigger menjadi "1" dengan mode Sama Persis, maka pelanggan harus menginput pas angka "1". Jika dia membalas "1 kak", bot tidak akan jalan. Gunakan mode Mengandung Kata untuk algoritma yang fleksibel.
        </div>

      </div>

      {/* KANAN: DATABASE ATURAN */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden h-full">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">Database Aturan Aktif</h3>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-3 py-1.5 rounded-lg shadow-sm border border-indigo-200">{autoReplies.length} Skrip Berjalan</span>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 relative p-6">
          {autoReplies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border-8 border-white shadow-sm hover:scale-105 transition-transform">
                <Bot size={36} className="text-slate-300" />
              </div>
              <p className="font-bold text-slate-600 text-xl tracking-tight">Bot Belum Diprogram</p>
              <p className="text-sm mt-2 max-w-sm mx-auto text-slate-500 leading-relaxed">Tambahkan instuksi kata kunci di panel bagian kiri agar Asisten Bot Anda mulai bekerja membalas pesan.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {autoReplies.map(r => (
                <div key={r.id} className="border border-slate-200 rounded-2xl overflow-hidden hover:border-indigo-300 transition-all group flex flex-col shadow-sm hover:shadow-md">
                  <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">Trigger</span>
                      <span className="px-3 py-1 bg-white border border-indigo-100 text-indigo-700 rounded-lg font-bold text-sm shadow-sm flex items-center gap-1.5">
                        <MessageSquare size={14} className="text-indigo-400" /> {r.keyword}
                      </span>
                      {r.is_exact_match ?
                        <span className="text-[10px] bg-slate-800 text-white font-semibold px-2 py-1 rounded shadow-sm">Sama Persis</span> :
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded border border-emerald-200">Mengandung Kata</span>
                      }
                    </div>
                    <button onClick={() => handleDeleteBotRule(r.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-inner border border-transparent hover:border-red-100 outline-none focus:ring-2 ring-red-500/20" title="Hapus Aturan">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="p-5 bg-white text-sm text-slate-700 whitespace-pre-wrap leading-relaxed relative">
                    <CornerDownRight size={16} className="absolute left-5 top-5 text-slate-300" />
                    <div className="pl-6 font-medium">{r.response_message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );


  const renderScreenContacts = () => (
    <div className="flex-1 p-6 md:p-8 h-full animate-in fade-in duration-300 flex flex-col lg:flex-row gap-6">

      {/* KIRI: PANEL PENGATURAN BUAT KONTAK */}
      <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col shrink-0 h-full overflow-y-auto pr-2 scrollbar-thin gap-6">

        {/* Title */}
        <div className="shrink-0">
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            <span className="bg-gradient-to-tr from-teal-500 to-emerald-400 text-white p-2.5 rounded-2xl shadow-lg shadow-teal-500/30">
              <Users size={20} />
            </span>
            Buku Telepon
          </h2>
          <p className="text-slate-500 mt-2 text-sm font-medium">Buku kontak khusus per akun untuk mempermudah Broadcast berulang.</p>
        </div>

        {/* Device Selector */}
        <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3 shrink-0">
          <div className="bg-teal-50 text-teal-600 p-2 rounded-xl shrink-0"><Smartphone size={20} /></div>
          <div className="flex flex-col flex-1 relative">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Perangkat Aktif</span>
            <CustomAccountDropdown options={sessions.filter(s => s.status === 'Ready' || s.status === 'Authenticated')} activeId={activeSessionId} onChange={setActiveSessionId} />
          </div>
        </div>

        {/* Form Tambah Baru */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden group shrink-0">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-teal-500 to-emerald-400"></div>
          <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-2"><UserPlus size={20} className="text-teal-500" /> Tambah Manual</h3>

          <div className="flex flex-col mb-5 relative group/input">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nama Panggilan</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-teal-500 transition"><Users size={16} /></span>
              <input type="text" value={newContactName} onChange={e => setNewContactName(e.target.value)} placeholder="Contoh: Budi Susanto" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 outline-none text-sm transition-all shadow-inner" />
            </div>
          </div>

          <div className="flex flex-col mb-8 relative group/input">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nomor WhatsApp</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-teal-500 transition"><MessageSquare size={16} /></span>
              <input type="text" value={newContactNumber} onChange={e => setNewContactNumber(e.target.value)} placeholder="Misal: 6281234567..." className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 outline-none text-sm font-mono transition-all shadow-inner" />
            </div>
          </div>

          <button disabled={isSavingContact || !activeSessionId} onClick={handleAddContact} className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/30 hover:-translate-y-0.5 active:translate-y-0">
            {isSavingContact ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {activeSessionId ? "Simpan ke Database" : "Pilih Perangkat Dulu"}
          </button>
        </div>

        {/* Import Google Sheets */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden group shrink-0">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-sky-500 to-blue-500"></div>
          <h3 className="font-bold text-slate-800 text-lg mb-2 flex items-center gap-2"><Link2 size={20} className="text-sky-500 -rotate-45" /> Import G-Sheets</h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">Secara otomatis mendeteksi kolom Nomor WhatsApp dari Spreadsheet Anda. <span className="font-bold text-sky-600">Pastikan status Share = Anyone with the link.</span></p>

          <div className="flex flex-col mb-4 relative group/input">
            <input type="text" value={sheetLink} disabled={isImportingSheet} onChange={e => setSheetLink(e.target.value)} placeholder="Tempel Link Spreadsheet di sini..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10 outline-none text-sm transition-all shadow-inner" />
          </div>

          <button onClick={handleImportSheet} disabled={isImportingSheet || !sheetLink.trim() || !activeSessionId} className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg disabled:bg-slate-300 disabled:text-slate-500 hover:-translate-y-0.5 active:translate-y-0">
            {isImportingSheet ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />} Import ke Database
          </button>
        </div>

        {/* CTA Banner */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-7 text-white shadow-xl relative overflow-hidden mt-auto shrink-0">
          <div className="absolute -right-6 -bottom-6 opacity-10"><Database size={120} /></div>
          <h4 className="font-bold text-lg mb-2 relative z-10 flex items-center gap-2"><Send size={18} className="text-indigo-400" /> Integrasi Blast</h4>
          <p className="text-sm text-indigo-200 leading-relaxed relative z-10 mb-6">Secara default, seluruh nomor kontak di dalam tabel (di sisi kanan) dapat Anda ekskusi langsung di jendela Blast Campaign.</p>
          <button onClick={() => setActiveMenu('blast')} className="px-4 py-2.5 bg-indigo-500/30 hover:bg-indigo-500/50 rounded-xl text-sm font-bold border border-indigo-500/50 transition relative z-10 flex items-center justify-center w-full gap-2"><Send size={16} /> Buka Layar Blast</button>
        </div>

      </div>

      {/* KANAN: LIST KONTAK */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden h-full">
        <div className="p-5 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
            Semua Kontak
            <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md text-xs ml-2">{dbContacts.length}</span>
          </h3>
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button onClick={loadDbContacts} className="px-3 py-1.5 hover:bg-slate-50 rounded-lg text-sm font-bold text-slate-600 flex items-center gap-2 transition"><RefreshCcw size={14} /> Segarkan Manual</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 relative">
          {dbContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border-8 border-white shadow-sm hover:scale-105 transition-transform">
                <Users size={32} className="text-slate-300" />
              </div>
              <p className="font-bold text-slate-600 text-xl tracking-tight">Database Masih Kosong</p>
              <p className="text-sm mt-2 max-w-sm mx-auto text-slate-500 leading-relaxed">Anda belum menyimpan kontak untuk sesi perangkat pengirim ini. Input data di borang sebelah kiri untuk mengisinya.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/80 text-xs text-slate-500 uppercase tracking-wider font-bold sticky top-0 backdrop-blur-md z-10 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 w-16 text-center">No</th>
                  <th className="px-6 py-4">Profil Kontak</th>
                  <th className="px-6 py-4">Nomor WhatsApp</th>
                  <th className="px-6 py-4 text-right">Opsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dbContacts.map((c, i) => (
                  <tr key={c.id} className="hover:bg-teal-50/20 transition-colors group">
                    <td className="px-6 py-4 text-center text-slate-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 text-white flex items-center justify-center font-bold shadow-sm ring-2 ring-white">
                          {c.contact_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-slate-700 group-hover:text-teal-700 transition">{c.contact_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {c.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-slate-600 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 group-hover:border-teal-100 group-hover:bg-white transition flex w-fit items-center gap-2">
                        <MessageSquare size={12} className="text-slate-400" /> {c.contact_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDeleteContact(c.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-inner border border-transparent hover:border-red-100 outline-none focus:ring-2 ring-red-500/20" title="Hapus Data">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );

  // --- MAIN LAYOUT (SIDEBAR & HEADER) ---
  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-500/30 overflow-hidden">

      {/* SIDEBAR MAIN MENU */}
      <div className="w-[80px] bg-white border-r border-slate-200 flex flex-col items-center py-6 flex-shrink-0 z-50 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
        <div className="w-12 h-12 bg-gradient-to-tr from-blue-700 to-indigo-600 rounded-xl flex items-center justify-center mb-8 shadow-lg shadow-blue-500/40 transform transition hover:scale-105 cursor-pointer">
          <span className="text-white text-xl font-black tracking-tighter">CRM</span>
        </div>
        <div className="flex flex-col gap-4 w-full px-3">
          <button onClick={() => setActiveMenu('devices')} className={`w-full aspect-square flex flex-col gap-1 items-center justify-center rounded-xl transition cursor-pointer group ${activeMenu === 'devices' ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`} title="Panel Koneksi HP">
            <Smartphone size={22} className={activeMenu === 'devices' ? '' : 'group-hover:-translate-y-0.5 transition-transform'} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Device</span>
          </button>
          <button onClick={() => setActiveMenu('blast')} className={`w-full aspect-square flex flex-col gap-1 items-center justify-center rounded-xl transition cursor-pointer group ${activeMenu === 'blast' ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`} title="Dashboard Broadcast">
            <Send size={22} className={activeMenu === 'blast' ? '' : 'group-hover:-translate-y-0.5 transition-transform'} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Blast</span>
          </button>
          <button onClick={() => setActiveMenu('chat')} className={`w-full aspect-square flex flex-col gap-1 items-center justify-center rounded-2xl transition ${activeMenu === 'chat' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>
            <MessageSquare size={22} className={activeMenu === 'chat' ? 'mb-0.5' : ''} />
            <span className="text-[10px] font-bold">Inbox</span>
          </button>
          <div className="w-8 mx-auto h-px bg-slate-200 my-1"></div>
          <button onClick={() => setActiveMenu('autoreply')} className={`w-full aspect-square flex flex-col gap-1 items-center justify-center rounded-2xl transition ${activeMenu === 'autoreply' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>
            <Bot size={22} className={activeMenu === 'autoreply' ? 'mb-0.5' : ''} />
            <span className="text-[10px] font-bold">Chatbot</span>
          </button>
          <div className="w-8 mx-auto h-px bg-slate-200 my-1"></div>
          <button onClick={() => setActiveMenu('contacts')} className={`w-full aspect-square flex flex-col gap-1 items-center justify-center rounded-2xl transition ${activeMenu === 'contacts' ? 'bg-teal-50 text-teal-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>
            <Users size={22} className={activeMenu === 'contacts' ? 'mb-0.5' : ''} />
            <span className="text-[10px] font-bold">Kontak</span>
          </button>
        </div>
        <div className="mt-auto px-3 w-full">
          <button className="w-full aspect-square flex flex-col gap-1 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition cursor-pointer" title="Database MySQL Status">
            <Database size={22} />
          </button>
        </div>
      </div>

      {/* RIGHT SIDE (CONTENT WRAPPER) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">

        {/* HEADER GLOBAL */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-8 z-40 shrink-0">
          <div className="flex items-center gap-4">
            <div className="text-slate-800 font-black text-xl tracking-tight hidden md:flex">
              Dashboard <span className="text-blue-600 ml-1">Enterprise</span>
            </div>
            <div className="h-5 w-px bg-slate-200 mx-1 hidden md:block"></div>
            <div className="px-3 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 text-blue-700 text-[11px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
              <Database size={12} /> XAMPP MySQL Linked
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-800 transition"><Bell size={18} /></button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-800 transition"><Grid size={18} /></button>
            <div className="h-4 w-px bg-slate-200 mx-1"></div>
            <div className="w-9 h-9 bg-slate-100 border text-slate-600 rounded-full flex items-center justify-center font-bold text-sm ml-1">
              UX
            </div>
          </div>
        </div>

        {/* DINAMIK RENDER BERDASARKAN MENU */}
        <div className="flex-1 overflow-hidden bg-slate-50/50 relative">
          {activeMenu === 'devices' && renderScreenDevices()}
          {activeMenu === 'blast' && renderScreenBlast()}
          {activeMenu === 'chat' && renderScreenChat()}
          {activeMenu === 'autoreply' && renderScreenBot()}
          {activeMenu === 'contacts' && renderScreenContacts()}
        </div>

      </div>

      {/* MODAL: TAMBAH PERANGKAT */}
      {isAddDeviceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200/50">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-6 text-white flex items-center gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 border border-white/20 backdrop-blur-[2px]"><Smartphone size={24} /></div>
              <div className="relative z-10">
                <h3 className="font-bold text-lg tracking-tight">Tambah Perangkat</h3>
                <p className="text-blue-100 text-[11px] mt-0.5 tracking-wide uppercase font-semibold">Tautkan WA Blast Baru</p>
              </div>
            </div>
            <div className="p-7 rounded-b-3xl bg-slate-50 relative">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">ID / Nama Sesi Perangkat</label>
              <input type="text" autoFocus value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitCreateSession()} placeholder="Contoh: CS Pusat 1" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-bold text-slate-800 transition-all shadow-inner mb-6 tracking-wide" />

              <div className="flex items-center justify-end gap-3 mt-2">
                <button onClick={() => setIsAddDeviceModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition">Batal</button>
                <button onClick={submitCreateSession} disabled={!newDeviceName.trim()} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-blue-500/30 hover:-translate-y-0.5"><Send size={16} /> Buat Sesi</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}