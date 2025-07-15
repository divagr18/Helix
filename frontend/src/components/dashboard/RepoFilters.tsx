// src/components/dashboard/RepoFilters.tsx
import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

interface RepoFiltersProps {
    onSearchChange: (value: string) => void;
    onSortChange: (value: string) => void;
    onFilterChange: (value: string) => void;
    sortValue: string;
    filterValue: string;
}

export const RepoFilters: React.FC<RepoFiltersProps> = ({ onSearchChange, onSortChange, onFilterChange, sortValue, filterValue }) => {
    return (
        <div className="flex flex-col md:flex-row items-stretch md:items-center space-y-3 md:space-y-0 md:space-x-4 w-full">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-full md:max-w-sm">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                    placeholder="Search repositories..."
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-8 h-10 text-sm bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-500 focus:ring-orange-500 focus:border-orange-500 w-full"
                />
            </div>

            {/* Sort Dropdown */}
            <Select value={sortValue} onValueChange={onSortChange}>
                <SelectTrigger className="w-full md:w-32 h-9 text-sm bg-zinc-950 border border-zinc-800 text-white">
                    <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 text-white border border-zinc-800">
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="last_synced">Last Synced</SelectItem>
                    <SelectItem value="coverage">Coverage</SelectItem>
                    <SelectItem value="orphans">Orphans</SelectItem>
                </SelectContent>
            </Select>

            {/* Filter Dropdown */}
            <Select value={filterValue} onValueChange={onFilterChange}>
                <SelectTrigger className="w-full md:w-36 h-9 text-sm bg-zinc-950 border border-zinc-800 text-white">
                    <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 text-white border border-zinc-800">
                    <SelectItem value="all">All Repos</SelectItem>
                    <SelectItem value="high-coverage">High Coverage</SelectItem>
                    <SelectItem value="needs-attention">Needs Attention</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
};
