// src/components/intelligence/docs/action-list-columns.tsx
"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles } from 'lucide-react';

export type DocStatus = {
    id: string;
    symbolName: string;
    filePath: string;
    status: 'Documented' | 'Missing' | 'Stale' | 'Needs Improvement';
    lastModified: string;
};

const getStatusBadge = (status: DocStatus['status']) => {
    switch (status) {
        case 'Documented': return <Badge variant="default" className="bg-green-500/20 text-green-400">Documented</Badge>;
        case 'Missing': return <Badge variant="destructive">Missing</Badge>;
        case 'Stale': return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">Stale</Badge>;
        case 'Needs Improvement': return <Badge variant="outline">Needs Improvement</Badge>;
    }
};

export const columns: ColumnDef<DocStatus>[] = [
    {
        accessorKey: "symbolName",
        header: "Symbol",
        cell: ({ row }) => (
            <div>
                <p className="font-medium">{row.original.symbolName}</p>
                <p className="text-xs text-muted-foreground">{row.original.filePath}</p>
            </div>
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
        accessorKey: "lastModified",
        header: "Last Modified",
    },
    {
        id: "actions",
        cell: ({ row }) => {
            if (row.original.status === 'Missing') {
                return (
                    <Button variant="outline" size="sm">
                        <Sparkles className="h-3 w-3 mr-2" />
                        Generate
                    </Button>
                );
            }
            return null;
        },
    },
];