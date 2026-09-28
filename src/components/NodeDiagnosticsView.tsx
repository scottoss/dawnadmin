import React, { useState, useEffect } from 'react';
import { stoatApi } from '../services/stoatApi';
import { RevoltConfig, MongoDbStatus } from '../types/stoat';
import {
  Server,
  Activity,
  HardDrive,
  Mic,
  Shield,
  Radio,
  FileCode,
  Gauge,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Database,
  Terminal,
  Save
} from 'lucide-react';

export const NodeDiagnosticsView: React.FC = () => {
  const [config, setConfig] = useState<RevoltConfig | null>(null);
  const [mongoStatus, setMongoStatus] = useState<MongoDbStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MongoDB connection settings form
  const [mongoUri, setMongoUri] = useState('');
  const [mongoDbName, setMongoDbName] = useState('revolt');
  const [isUpdatingMongo, setIsUpdatingMongo] = useState(false);
  const [mongoUpdateMsg, setMongoUpdateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nodeConfig, dbStatus] = await Promise.all([
        stoatApi.queryNode().catch(() => null),
        stoatApi.getMongoDbStatus().catch(() => null),
      ]);
      setConfig(nodeConfig);
      setMongoStatus(dbStatus);
      if (dbStatus?.dbName) {
        setMongoDbName(dbStatus.dbName);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveMongoConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mongoUri.trim()) return;
    setIsUpdatingMongo(true);
    setMongoUpdateMsg(null);
    try {
      const updated = await stoatApi.configureMongoDb(mongoUri.trim(), mongoDbName.trim());
      setMongoStatus(updated);
      setMongoUpdateMsg({
        type: updated.connected ? 'success' : 'error',
        text: updated.connected
          ? 'Connected successfully to main Stoat MongoDB database!'
          : `Failed to connect: ${updated.error || 'Check URI host & credentials'}`,
      });
    } catch (err) {
      setMongoUpdateMsg({ type: 'error', text: `Error updating MongoDB: ${(err as Error).message}` });
    } finally {
      setIsUpdatingMongo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">DawnChat Node & MongoDB Diagnostics</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Direct MongoDB database connectivity, server microservices, and global quotas.
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Diagnostics
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">
          Failed to query diagnostics: {error}
        </div>
      )}

      {/* MongoDB Direct Connection Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              mongoStatus?.connected
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Main Stoat MongoDB Database</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  mongoStatus?.connected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}>
                  {mongoStatus?.connected ? (mongoStatus?.isMock ? 'SIMULATED MONGODB' : 'CONNECTED') : 'DISCONNECTED'}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Primary data store for users, accounts, channels, servers, platform bans, and safety reports.
              </p>
            </div>
          </div>
        </div>

        {mongoUpdateMsg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
              mongoUpdateMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            <span>{mongoUpdateMsg.text}</span>
            <button onClick={() => setMongoUpdateMsg(null)} className="hover:underline">Dismiss</button>
          </div>
        )}

        {/* Collections Overview */}
        {mongoStatus?.collections && (
          <div>
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
              Detected MongoDB Collections
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {mongoStatus.collections.map((c) => (
                <div key={c.name} className="p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                  <span className="text-[11px] text-neutral-400 block font-mono">{c.name}</span>
                  <span className="text-base font-bold text-white block mt-0.5 font-mono tabular-nums">
                    {c.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MongoDB Connection Config Drawer */}
        <form onSubmit={handleSaveMongoConfig} className="pt-2 border-t border-neutral-800/80 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            Connect / Configure Main MongoDB Instance URI:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="md:col-span-2">
              <input
                type="text"
                value={mongoUri}
                onChange={(e) => setMongoUri(e.target.value)}
                placeholder="mongodb://username:password@mongo-host:27017/revolt?authSource=admin"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={mongoDbName}
                onChange={(e) => setMongoDbName(e.target.value)}
                placeholder="revolt"
                className="w-24 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={isUpdatingMongo || !mongoUri.trim()}
                className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-950 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {isUpdatingMongo ? 'Connecting...' : 'Connect DB'}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-neutral-500">
            You can also configure this by adding <code className="text-neutral-400">MONGODB_URI</code> to your environment file.
          </p>
        </form>
      </div>

      {config && (
        <div className="space-y-6">
          {/* Core Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
              <span className="text-[11px] text-neutral-400 block font-medium">Stoat API Version</span>
              <span className="text-base font-bold text-white mt-1 block font-mono">
                v{config.stoat}
              </span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
                <CheckCircle className="w-3 h-3" /> Compatible with Revolt v{config.revolt}
              </span>
            </div>

            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
              <span className="text-[11px] text-neutral-400 block font-medium">WebSocket Gateway</span>
              <span className="text-xs font-bold text-neutral-200 mt-1 block font-mono truncate">
                {config.ws}
              </span>
              <span className="text-[10px] text-neutral-400 mt-1 block">Real-time sync pipeline</span>
            </div>

            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
              <span className="text-[11px] text-neutral-400 block font-medium">Client Web Target</span>
              <a
                href={config.app}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-amber-400 hover:underline mt-1 flex items-center gap-1 font-mono truncate"
              >
                {config.app}
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
              <span className="text-[10px] text-neutral-400 mt-1 block">Official web client</span>
            </div>

            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
              <span className="text-[11px] text-neutral-400 block font-medium">Registration Mode</span>
              <span className="text-base font-bold text-white mt-1 block">
                {config.features?.invite_only ? 'Invite Only' : 'Open Registration'}
              </span>
              <span className="text-[10px] text-neutral-400 mt-1 block">
                Email verification: {config.features?.email ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Microservices Breakdown */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Connected Microservices & Subsystems
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Autumn */}
              <div className="p-3.5 bg-neutral-950 rounded-lg border border-neutral-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-neutral-200">
                    <HardDrive className="w-4 h-4 text-amber-400" />
                    Autumn (File Server)
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    config.features?.autumn?.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {config.features?.autumn?.enabled ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-mono truncate">
                  {config.features?.autumn?.url || 'Internal Storage'}
                </p>
              </div>

              {/* January */}
              <div className="p-3.5 bg-neutral-950 rounded-lg border border-neutral-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-neutral-200">
                    <Radio className="w-4 h-4 text-blue-400" />
                    January (Embed Proxy)
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    config.features?.january?.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {config.features?.january?.enabled ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-mono truncate">
                  {config.features?.january?.url || 'Proxy Disabled'}
                </p>
              </div>

              {/* LiveKit Voice */}
              <div className="p-3.5 bg-neutral-950 rounded-lg border border-neutral-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-neutral-200">
                    <Mic className="w-4 h-4 text-purple-400" />
                    LiveKit (Voice/Video)
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    config.features?.livekit?.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {config.features?.livekit?.enabled ? 'ACTIVE' : 'OFFLINE'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-mono">
                  {config.features?.livekit?.nodes?.length || 0} active voice cluster nodes
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
