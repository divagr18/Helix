// src/components/intelligence/orphan-columns.tsx
"use client"

import { type ColumnDef } from "@tanstack/react-table"
import { Link } from 'react-router-dom'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { type CodeSymbol } from '@/types'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"

export type OrphanData = Pick<CodeSymbol, 'id' | 'name' | 'loc' | 'cyclomatic_complexity' | 'start_line'> & {
  file_path: string | null;
  class_name: string | null;
};

export const columns: ColumnDef<OrphanData>[] = [
  // --- Selection Checkbox Column ---
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Symbol",
    cell: ({ row }) => {
      const { activeRepository } = useWorkspaceStore.getState();
      const symbol = row.original;
      const link = activeRepository ? `/repository/${activeRepository.id}/code?file=${symbol.file_path}&line=${symbol.start_line}` : '#';
      return (
        <Link to={link} className="font-mono hover:underline text-primary">
          {symbol.name}
        </Link>
      );
    },
  },
  {
    accessorKey: "file_path",
    // --- Refined Header for Sorting ---
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="-ml-4" // Negative margin to align with cell padding
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          File Path
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => <div className="text-muted-foreground">{row.original.file_path}</div>,
  },
  {
    accessorKey: "cyclomatic_complexity",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="w-full justify-end -mr-4"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Complexity
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const complexity = row.original.cyclomatic_complexity;
      const colorClass = complexity && complexity > 10 ? 'text-destructive font-bold' : complexity && complexity > 5 ? 'text-yellow-500 font-semibold' : '';
      return <div className={`text-right font-medium ${colorClass}`}>{complexity}</div>;
    },
  },
  // --- Row Actions Column ---
  {
    id: "actions",
    cell: ({ row }) => {
      const symbol = row.original
      return (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(symbol.name)}>
                Copy symbol name
              </DropdownMenuItem>
              {/* Add more actions here later, e.g., "Ignore this orphan" */}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
    enableHiding: false,
  },
]