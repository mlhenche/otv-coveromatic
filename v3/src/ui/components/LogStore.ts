import { useState, useEffect } from 'react';

export type LogEntry = {
    id: number;
    title: string;
    subtitle?: string;
    badges?: string[];
    timestamp: Date;
};

let logs: LogEntry[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

export const Logger = {
    add: (title: string, subtitle?: string, badges?: string[]) => {
        logs = [{ id: nextId++, title, subtitle, badges, timestamp: new Date() }, ...logs];
        listeners.forEach(l => l());
    },
    clear: () => {
        logs = [];
        listeners.forEach(l => l());
    },
    get: () => logs,
    subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    }
};

export function useLogs() {
    const [currentLogs, setCurrentLogs] = useState(logs);

    useEffect(() => {
        return Logger.subscribe(() => {
            setCurrentLogs(Logger.get());
        });
    }, []);

    return currentLogs;
}
