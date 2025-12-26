"use client";

import { useEffect, useState } from "react";
import { Plus, Rocket, Trash2, Github, ExternalLink, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import EnvVarsEditor from './EnvVarsEditor';

// Types
interface App {
    id: string;
    name: string;
    repo_url: string;
    branch: string;
    env_vars?: Record<string, string>;
    last_status?: string;
    last_url?: string;
}

// API URL must be configured via environment variable - no hardcoded fallback for open-source compatibility
const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
    console.error('NEXT_PUBLIC_API_URL environment variable is not set');
}

// Helper to construct auth headers
function getAuthHeaders(userId: string, accessToken?: string): HeadersInit {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
    };
    if (accessToken) {
        headers['X-Github-Token'] = accessToken;
    }
    return headers;
}

export default function Dashboard({ userId, accessToken }: { userId: string, accessToken?: string }) {
    const [apps, setApps] = useState<App[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [appName, setAppName] = useState("");
    const [repoUrl, setRepoUrl] = useState("");
    const [branch, setBranch] = useState("main");
    const [envVars, setEnvVars] = useState<Record<string, string>>({});

    const [deployingId, setDeployingId] = useState<string | null>(null);

    useEffect(() => {
        fetchApps();
    }, []);

    async function fetchApps() {
        try {
            const res = await fetch(`${API_URL}/apps`, {
                headers: getAuthHeaders(userId),
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                setApps(data);
            } else {
                console.error("API returned non-array:", data);
                setApps([]);
            }
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch apps", error);
            setLoading(false);
        }
    }

    async function createApp() {
        if (!appName || !repoUrl) return;
        try {
            const res = await fetch(`${API_URL}/apps`, {
                method: "POST",
                headers: getAuthHeaders(userId),
                body: JSON.stringify({
                    name: appName,
                    repo_url: repoUrl,
                    branch: branch,
                    env_vars: envVars,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                const detailedError = errorData.error ? `${errorData.message}: ${errorData.error}` : (errorData.message || `HTTP ${res.status}`);
                throw new Error(detailedError);
            }

            setIsModalOpen(false);
            setAppName("");
            setRepoUrl("");
            setBranch("main");
            setEnvVars({});
            fetchApps();
        } catch (e: any) {
            alert("Failed to create app: " + (e.message || e));
        }
    }

    async function deployApp(app: App) {
        if (!confirm(`Deploy ${app.name}?`)) return;
        setDeployingId(app.id);
        try {
            const res = await fetch(`${API_URL}/apps/${app.id}/deploy`, {
                method: "POST",
                headers: getAuthHeaders(userId, accessToken),
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            alert("Deployment triggered!");
            setTimeout(fetchApps, 2000);
        } catch (e) {
            alert("Deploy failed");
        } finally {
            setDeployingId(null);
        }
    }

    async function deleteApp(appId: string) {
        if (!confirm("Are you sure? This will delete the app and all deployments.")) return;
        try {
            const res = await fetch(`${API_URL}/apps/${appId}`, {
                method: "DELETE",
                headers: getAuthHeaders(userId),
            });
            if (res.ok || res.status === 204) {
                fetchApps();
            } else {
                alert("Delete failed");
            }
        } catch (e) {
            alert("Delete failed");
        }
    }

    const getStatusColor = (status?: string) => {
        if (status === "SUCCESS") return "bg-green-500/10 text-green-400 border-green-500/20";
        if (status === "FAILED") return "bg-red-500/10 text-red-400 border-red-500/20";
        if (status === "QUEUED") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    };

    return (
        <div>
            <div className="flex justify-end mb-6 -mt-16">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-[#238636] hover:bg-[#2ea043] text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    <Plus size={20} /> New App
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                    {apps.map((app) => (
                        <motion.div
                            key={app.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-[#161b22]/80 backdrop-blur-md border border-[#30363d] p-6 rounded-xl relative group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                    <Github size={24} />
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(app.last_status)}`}>
                                    {app.last_status || "NO DEPLOY"}
                                </div>
                            </div>

                            <h3 className="text-xl font-semibold mb-1">{app.name}</h3>
                            <p className="text-sm text-gray-400 mb-6 truncate">{app.repo_url}</p>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => deployApp(app)}
                                    disabled={deployingId === app.id}
                                    className="flex-1 flex items-center justify-center gap-2 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                                >
                                    {deployingId === app.id ? <RefreshCw className="animate-spin" size={16} /> : <Rocket size={16} />}
                                    Deploy
                                </button>

                                {app.last_url && (
                                    <a
                                        href={app.last_url}
                                        target="_blank"
                                        className="flex items-center justify-center px-3 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-blue-400 rounded-lg transition-all"
                                    >
                                        <ExternalLink size={18} />
                                    </a>
                                )}

                                <button
                                    onClick={() => deleteApp(app.id)}
                                    className="flex items-center justify-center px-3 bg-red-900/10 hover:bg-red-900/30 border border-red-900/20 text-red-400 rounded-lg transition-all"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Empty State */}
            {!loading && apps.length === 0 && (
                <div className="text-center py-20 text-gray-500">
                    <p>No apps found. Create your first one!</p>
                </div>
            )}

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl w-full max-w-md shadow-2xl"
                    >
                        <h2 className="text-xl font-bold mb-4">Create New App</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">App Name</label>
                                <input
                                    value={appName}
                                    onChange={(e) => setAppName(e.target.value)}
                                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="my-cool-app"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">GitHub Repo</label>
                                <input
                                    value={repoUrl}
                                    onChange={(e) => setRepoUrl(e.target.value)}
                                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="owner/repo"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Branch</label>
                                <input
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="main"
                                />
                            </div>

                            {/* Environment Variables Editor */}
                            <div className="pt-2">
                                <EnvVarsEditor envVars={envVars} onChange={setEnvVars} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createApp}
                                className="bg-[#238636] hover:bg-[#2ea043] text-white px-4 py-2 rounded-lg font-medium"
                            >
                                Create App
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
