import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { motion } from 'framer-motion';
import api from '../api/axios';
import Navbar from '../components/ui/Navbar';
import { Vault, ArrowRight, ArrowDownLeft, ArrowUpRight, ShieldCheck, Activity } from 'lucide-react';

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }) };

const TiltCard = ({ children, className = "" }) => {
    const ref = useRef(null);
    const handleMove = (e) => {
      const el = ref.current; if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      el.style.transform = `perspective(1000px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg) scale3d(1.01,1.01,1.01)`;
    };
    const handleLeave = () => { if (ref.current) ref.current.style.transform = "perspective(1000px) rotateX(0) rotateY(0) scale3d(1,1,1)"; };
    return (
      <div ref={ref} onMouseMove={handleMove} onMouseLeave={handleLeave} className={`will-change-transform ${className}`} style={{ transformStyle: "preserve-3d", transition: "transform 0.15s ease-out" }}>
        {children}
      </div>
    );
};

export default function Dashboard() {
    const { user, logout } = useContext(AuthContext); // Added logout here
    const navigate = useNavigate();
    
    const [balanceData, setBalanceData] = useState(null);
    const [history, setHistory] = useState([]);
    const [transferForm, setTransferForm] = useState({ receiver: '', amount: '' });
    const [msg, setMsg] = useState({ text: '', type: '' });

    useEffect(() => {
        if (!user) navigate('/login');
        else fetchData();
    }, [user, navigate]);

    const fetchData = async () => {
        try {
            const balRes = await api.get('/banking/balance');
            setBalanceData(balRes.data);
            const histRes = await api.get('/banking/history');
            setHistory(histRes.data);
        } catch (err) {
            console.error("Error fetching data", err);
            // FIX: If the backend rejects the request (e.g. cookie expired), log them out
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                logout(); 
            }
        }
    };

    const handleTransfer = async (e) => {
        e.preventDefault();
        setMsg({ text: 'Acquiring row locks & executing...', type: 'info' });
        try {
            await api.post('/banking/transfer', {
                receiver_account_no: transferForm.receiver,
                amount: parseFloat(transferForm.amount)
            });
            setMsg({ text: 'Atomic transfer successful. Ledger updated.', type: 'success' });
            setTransferForm({ receiver: '', amount: '' });
            fetchData(); // Refresh data
        } catch (err) {
            setMsg({ text: err.response?.data?.error || 'Transfer failed', type: 'error' });
        }
    };

    if (!balanceData) return (
        <div className="min-h-screen pt-20 flex flex-col items-center justify-center bg-transparent" style={{ color: 'var(--text-primary)' }}>
            <Activity className="animate-spin mb-4" size={48} style={{ color: 'var(--brand-primary)' }} />
            <p className="font-bold tracking-wider uppercase text-sm" style={{ color: 'var(--text-secondary)' }}>Decrypting Ledger Data...</p>
        </div>
    );

    return (
        <div className="w-full bg-transparent pt-24 pb-20">
            <Navbar />
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT COLUMN: Balance & Transfer */}
                <div className="lg:col-span-1 space-y-8">
                    <motion.div initial="hidden" animate="visible" variants={fadeUp}>
                        <TiltCard className="rounded-3xl p-8 border glow-emerald" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ background: 'var(--brand-primary)' }}>
                                    <Vault size={24} />
                                </div>
                                <div className="px-3 py-1 rounded-full text-xs font-bold border" style={{ background: balanceData.status === 'ACTIVE' ? 'rgba(5,150,105,0.1)' : 'rgba(225,29,72,0.1)', color: balanceData.status === 'ACTIVE' ? 'var(--brand-primary)' : '#e11d48', borderColor: balanceData.status === 'ACTIVE' ? 'var(--brand-primary)' : '#e11d48' }}>
                                    {balanceData.status}
                                </div>
                            </div>
                            <p className="text-sm font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>Available Liquidity</p>
                            <h2 className="text-4xl font-extrabold font-mono mb-4 shimmer-text">${parseFloat(balanceData.balance).toFixed(2)}</h2>
                            <div className="pt-4 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                                <span>Account ID:</span>
                                <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{balanceData.account_no}</span>
                            </div>
                        </TiltCard>
                    </motion.div>

                    <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp} className="rounded-3xl p-8 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Activity size={20} style={{ color: 'var(--brand-primary)' }}/> Execute Transfer</h3>
                        
                        {msg.text && (
                            <div className="p-4 rounded-xl text-sm font-bold mb-6 border" style={{ background: msg.type === 'error' ? 'rgba(225,29,72,0.1)' : msg.type === 'success' ? 'rgba(5,150,105,0.1)' : 'var(--bg-hover)', color: msg.type === 'error' ? '#e11d48' : msg.type === 'success' ? 'var(--brand-primary)' : 'var(--text-primary)', borderColor: msg.type === 'error' ? 'rgba(225,29,72,0.3)' : msg.type === 'success' ? 'rgba(5,150,105,0.3)' : 'var(--border-default)' }}>
                                {msg.text}
                            </div>
                        )}

                        <form onSubmit={handleTransfer} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Destination Account</label>
                                <input required value={transferForm.receiver} onChange={e => setTransferForm({...transferForm, receiver: e.target.value})} type="text" placeholder="FLXXXXXXXXXX" className="w-full p-4 rounded-xl border focus:ring-2 font-mono text-sm transition-all" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', outlineColor: 'var(--brand-primary)' }} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Amount (USD)</label>
                                <input required value={transferForm.amount} onChange={e => setTransferForm({...transferForm, amount: e.target.value})} type="number" step="0.01" min="1" placeholder="0.00" className="w-full p-4 rounded-xl border focus:ring-2 font-mono text-sm transition-all" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', outlineColor: 'var(--brand-primary)' }} />
                            </div>
                            <button type="submit" className="w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 group transition-all" style={{ background: 'var(--brand-primary)' }}>
                                Initiate Protocol <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </form>
                    </motion.div>
                </div>

                {/* RIGHT COLUMN: History */}
                <div className="lg:col-span-2">
                    <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp} className="rounded-3xl p-8 border h-full" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                        <div className="flex items-center justify-between mb-8 pb-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
                            <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><ShieldCheck size={20} style={{ color: 'var(--brand-primary)' }}/> Immutable Audit Trail</h3>
                        </div>

                        {history.length === 0 ? (
                            <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>No executions found on the ledger.</div>
                        ) : (
                            <div className="space-y-4">
                                {history.map((tx, idx) => {
                                    const isSender = tx.sender_account === balanceData.account_no;
                                    return (
                                        <motion.div key={tx.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} className="flex items-center justify-between p-4 rounded-2xl border hover:-translate-y-0.5 transition-transform" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-default)' }}>
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: isSender ? 'rgba(225,29,72,0.1)' : 'rgba(5,150,105,0.1)', color: isSender ? '#e11d48' : 'var(--brand-primary)' }}>
                                                    {isSender ? <ArrowUpRight size={18}/> : <ArrowDownLeft size={18}/>}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                                                        {isSender ? `Transfer to ${tx.receiver_account}` : `Received from ${tx.sender_account || 'System'}`}
                                                    </p>
                                                    <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-secondary)' }}>TxID: {tx.id.substring(0,8)}... • {new Date(tx.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold font-mono" style={{ color: isSender ? '#e11d48' : 'var(--brand-primary)' }}>
                                                    {isSender ? '-' : '+'}${parseFloat(tx.amount).toFixed(2)}
                                                </p>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                </div>

            </div>
        </div>
    );
}