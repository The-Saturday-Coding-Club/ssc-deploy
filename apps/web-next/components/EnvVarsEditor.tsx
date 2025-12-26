'use client';

import { useState } from 'react';

interface EnvVarsEditorProps {
    envVars: Record<string, string>;
    onChange: (vars: Record<string, string>) => void;
}

export default function EnvVarsEditor({ envVars, onChange }: EnvVarsEditorProps) {
    const [entries, setEntries] = useState<Array<{ key: string; value: string; showValue: boolean }>>(
        Object.entries(envVars).map(([key, value]) => ({ key, value, showValue: false }))
    );

    const updateEnvVars = (newEntries: typeof entries) => {
        const vars: Record<string, string> = {};
        newEntries.forEach(({ key, value }) => {
            if (key.trim()) {
                vars[key.trim()] = value;
            }
        });
        onChange(vars);
    };

    const addEntry = () => {
        const newEntries = [...entries, { key: '', value: '', showValue: true }];
        setEntries(newEntries);
    };

    const removeEntry = (index: number) => {
        const newEntries = entries.filter((_, i) => i !== index);
        setEntries(newEntries);
        updateEnvVars(newEntries);
    };

    const updateEntry = (index: number, field: 'key' | 'value', newValue: string) => {
        const newEntries = [...entries];
        newEntries[index][field] = newValue;
        setEntries(newEntries);
        updateEnvVars(newEntries);
    };

    const toggleShowValue = (index: number) => {
        const newEntries = [...entries];
        newEntries[index].showValue = !newEntries[index].showValue;
        setEntries(newEntries);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Environment Variables
                </label>
                <button
                    type="button"
                    onClick={addEntry}
                    className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                >
                    + Add Variable
                </button>
            </div>

            {entries.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No environment variables set. Click "+ Add Variable" to add one.
                </p>
            ) : (
                <div className="space-y-2">
                    {entries.map((entry, index) => (
                        <div key={index} className="flex gap-2 items-start">
                            <input
                                type="text"
                                placeholder="KEY"
                                value={entry.key}
                                onChange={(e) => updateEntry(index, 'key', e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm font-mono"
                            />
                            <div className="flex-1 relative">
                                <input
                                    type={entry.showValue ? 'text' : 'password'}
                                    placeholder="value"
                                    value={entry.value}
                                    onChange={(e) => updateEntry(index, 'value', e.target.value)}
                                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => toggleShowValue(index)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                    title={entry.showValue ? 'Hide value' : 'Show value'}
                                >
                                    {entry.showValue ? '🙈' : '👁️'}
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => removeEntry(index)}
                                className="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded transition"
                                title="Remove variable"
                            >
                                🗑️
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {entries.filter(e => !e.key.trim()).length > 0 && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    ⚠️ Variables with empty keys will be ignored
                </p>
            )}
        </div>
    );
}
