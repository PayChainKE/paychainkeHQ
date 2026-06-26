import React, { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api/api';

const Messages = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [filter, setFilter] = useState('All');
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get('/api/contact');
        const json = response.data;
        setData(json);
        if (json.length > 0 && !selectedMessage) {
          setSelectedMessage(json[0]);
        }
      } catch (err) {
        setError(err.response?.data?.error || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredMessages = filter === 'All' 
    ? data 
    : filter === 'Unread' 
      ? data.filter(m => !m.isRead)
      : data.filter(m => m.contactType === 'merchant');

  const stats = {
    unread: data.filter(m => !m.isRead).length
  };

  return (
    <Layout>
      <div className="flex -m-4 md:-m-8 h-[calc(100vh-56px)] md:h-[calc(100vh-64px)] overflow-hidden relative">
        {/* LEFT PANEL: MESSAGE LIST */}
        <section className={`w-full md:w-[380px] bg-surface flex flex-col h-full overflow-hidden font-body transition-all duration-300 ${
          isMobileDetailOpen ? 'translate-x-[-100%] md:translate-x-0 hidden md:flex' : 'translate-x-0 flex'
        } border-r border-outline-variant/10 shadow-editorial md:shadow-none z-10`}>
          <div className="p-4 space-y-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] md:text-sm font-bold text-on-surface uppercase tracking-widest font-headline">Inquiry Inbox</h2>
              <span className="px-2 py-0.5 bg-secondary-container/20 text-secondary text-[10px] md:text-[11px] font-bold rounded-lg tracking-tight uppercase">{stats.unread} UNREAD</span>
            </div>
            <div className="flex gap-1 bg-surface-container-low p-1 rounded-xl">
              {['All', 'Unread', 'Merchants'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 text-[11px] md:text-[12px] py-1.5 rounded-lg transition-all font-label tracking-tight ${
                    filter === f 
                      ? 'bg-surface shadow-sm text-primary font-bold' 
                      : 'text-on-surface-variant/60 hover:bg-surface/50 font-medium'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar font-body pb-20 md:pb-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[12px] text-on-surface-variant/40">Loading inquiries...</p>
              </div>
            ) : error ? (
              <div className="p-4 text-center text-error text-xs">{error}</div>
            ) : filteredMessages.length === 0 ? (
              <div className="p-10 text-center text-on-surface-variant/30 text-sm">No messages found.</div>
            ) : (
              filteredMessages.map((m) => (
                <div 
                  key={m._id}
                  onClick={() => {
                    setSelectedMessage(m);
                    setIsMobileDetailOpen(true);
                  }}
                  className={`group relative px-4 py-4 cursor-pointer transition-all border-b border-outline-variant/5 ${
                    selectedMessage?._id === m._id ? 'bg-surface-container-low' : 'hover:bg-surface-container-lowest'
                  } ${!m.isRead ? 'border-l-[3px] border-secondary' : 'border-l-[3px] border-transparent'}`}
                >
                  <div className="flex gap-3">
                    <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-[10px] md:text-xs uppercase shadow-sm ${
                      !m.isRead ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant/40'
                    }`}>
                      {(m.name || 'Unknown').split(' ')[0]?.[0] || ''}{(m.name || 'Unknown').split(' ')[1]?.[0] || (m.name?.[1] || 'M')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <span className={`text-[12px] md:text-[13px] truncate ${!m.isRead ? 'font-bold text-on-surface' : 'font-medium text-on-surface-variant/70'}`}>{m.name}</span>
                        <span className="text-[10px] md:text-[11px] font-bold text-on-surface-variant/30 whitespace-nowrap font-label">{new Date(m.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h3 className={`text-[12px] md:text-[13px] truncate mb-1 tracking-tight ${!m.isRead ? 'font-bold text-on-surface' : 'font-medium text-on-surface-variant/70'}`}>{m.subject}</h3>
                      <p className={`text-[11px] md:text-[12px] line-clamp-1 md:line-clamp-2 leading-relaxed ${!m.isRead ? 'text-on-surface-variant/60' : 'text-on-surface-variant/40'}`}>{m.message}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* RIGHT PANEL: MESSAGE DETAIL */}
        <section className={`flex-1 bg-surface-container-low flex flex-col h-full overflow-hidden transition-all duration-300 ${
          isMobileDetailOpen ? 'flex' : 'hidden md:flex'
        }`}>
          {selectedMessage ? (
            <>
              {/* Mobile Back Button */}
              <div className="md:hidden flex items-center px-4 py-3 bg-surface border-b border-outline-variant/10">
                <button 
                  onClick={() => setIsMobileDetailOpen(false)}
                  className="flex items-center gap-2 text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest font-label"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                  Back to Inbox
                </button>
              </div>

              <div className="mx-4 md:mx-6 mt-4 md:mt-6 p-4 md:p-6 bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 font-body">
                <div className="flex justify-between items-start mb-4 md:mb-6">
                  <div className="space-y-1">
                    <h2 className="text-[18px] md:text-[22px] font-semibold tracking-tight text-on-surface leading-snug">{selectedMessage.subject}</h2>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="inline-block px-2 py-0.5 bg-secondary-container/20 text-secondary text-[10px] font-bold rounded-lg uppercase tracking-widest font-label w-fit">{selectedMessage.contactType}</span>
                      <span className="text-[10px] md:text-xs text-on-surface-variant/40 font-medium">• Received {new Date(selectedMessage.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 md:gap-2">
                    <button className="p-1.5 md:p-2 text-on-surface-variant/30 hover:text-secondary hover:bg-secondary-container/10 rounded-lg transition-all">
                      <span className="material-symbols-outlined text-[20px] md:text-[24px]">star</span>
                    </button>
                    <button className="p-1.5 md:p-2 text-on-surface-variant/30 hover:text-error hover:bg-error-container/10 rounded-lg transition-all">
                      <span className="material-symbols-outlined text-[20px] md:text-[24px]">flag</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 border-t border-outline-variant/5 pt-4 md:pt-6">
                  <div className="space-y-1">
                    <p className="text-[10px] md:text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest font-label">From</p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-on-secondary uppercase shadow-sm">
                        {selectedMessage.name.split(' ')[0][0]}{selectedMessage.name.split(' ')[1]?.[0] || 'M'}
                      </div>
                      <p className="text-xs md:text-[13px] font-bold text-on-surface tracking-tight">{selectedMessage.name}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] md:text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest font-label">Email Address</p>
                    <p className="text-xs md:text-[13px] font-bold text-secondary underline decoration-secondary/30 underline-offset-4 tracking-tight truncate">{selectedMessage.email}</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                    <p className="text-[10px] md:text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest font-label">Phone Number</p>
                    <div className="flex items-center gap-2 group cursor-pointer">
                      <p className="text-xs md:text-[13px] font-bold text-on-surface tracking-tight">{selectedMessage.phone || 'N/A'}</p>
                      {selectedMessage.phone && <span className="material-symbols-outlined text-[14px] md:text-[16px] text-on-surface-variant/20 group-hover:text-secondary transition-colors">content_copy</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 px-6 md:px-10 py-6 md:py-8 overflow-y-auto custom-scrollbar">
                <div className="max-w-3xl text-[13px] md:text-[14px] leading-[1.8] text-[#1b1c1a] space-y-4 whitespace-pre-wrap">
                  {selectedMessage.message}
                </div>
              </div>
              <div className="p-4 md:p-6 bg-surface border-t border-outline-variant/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 font-body">
                <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                  <button className="w-full sm:w-auto px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-lg shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2 font-label uppercase tracking-widest">
                    <span className="material-symbols-outlined text-[18px]">reply</span>
                    Reply
                  </button>
                  <button className="w-full sm:w-auto px-5 py-2.5 bg-surface-container-low border border-outline-variant/30 text-on-surface text-xs font-bold rounded-lg hover:bg-surface-container-high transition-all font-label uppercase tracking-widest">
                    Mark Read
                  </button>
                </div>
                <button className="px-4 py-2 text-error text-xs font-bold rounded-lg hover:bg-error-container/10 transition-all flex items-center justify-center gap-2 font-label uppercase tracking-widest">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  Delete
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <span className="material-symbols-outlined text-6xl mb-4">mail</span>
              <p className="text-lg font-medium">Select a message to read</p>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default Messages;
