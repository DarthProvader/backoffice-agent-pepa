"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TableResponse {
  rows: Record<string, unknown>[];
  columns: string[];
  columnLabels: string[];
  total: number;
  page: number;
  pageSize: number;
}

const TABS = [
  { key: "clients", label: "Klienti" },
  { key: "properties", label: "Nemovitosti" },
  { key: "leads", label: "Leady" },
  { key: "sales", label: "Prodeje" },
  { key: "viewings", label: "Prohl\ídky" },
  { key: "listing_snapshots", label: "Inzer\áty" },
] as const;

type TableName = (typeof TABS)[number]["key"];

export function DataTable() {
  const [tableName, setTableName] = useState<TableName>("clients");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [data, setData] = useState<TableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: String(page) });
    if (debouncedSearch) params.set("search", debouncedSearch);

    apiFetch<TableResponse>(`/api/dashboard/tables/${tableName}?${params}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tableName, page, debouncedSearch]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const handleTabChange = (key: TableName) => {
    setTableName(key);
    setPage(1);
    setSearch("");
    setDebouncedSearch("");
  };

  return (
    <div className="rounded-lg border border-[#222] bg-[#0a0a0a]">
      {/* Header: tabs + search */}
      <div className="flex flex-col gap-3 border-b border-[#222] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tableName === tab.key
                  ? "bg-[#222] text-[#ededed]"
                  : "text-[#888] hover:text-[#ededed] hover:bg-[#111]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#888]" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Hledat..."
            className="w-full rounded-lg border border-[#222] bg-[#0a0a0a] py-2 pl-9 pr-3 text-sm text-[#ededed] placeholder:text-[#555] focus:border-[#0070f3] focus:outline-none sm:w-56"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-[#888]">
            Na\č\ít\án\í...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-sm text-red-400">
            Chyba: {error}
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-[#888]">
            \Ž\ádn\á data
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {data.columnLabels.map((label, i) => (
                  <th
                    key={data.columns[i]}
                    className="sticky top-0 border-b border-[#222] bg-[#111]/50 px-3 py-2 text-left text-xs font-medium text-[#888]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="transition-colors hover:bg-[#111]/30">
                  {data.columns.map((col) => (
                    <td
                      key={col}
                      className="border-b border-[#222] px-3 py-2 text-sm text-[#ededed]/80"
                    >
                      {row[col] != null ? String(row[col]) : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between border-t border-[#222] px-4 py-3">
          <span className="text-xs text-[#888]">
            Strana {page} z {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Předchozí
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Další
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
