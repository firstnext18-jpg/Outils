"use client";

import { DownloadIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Export de la liste affichée (mêmes filtres et même tri). */
export function ExportMenu() {
  const searchParams = useSearchParams();
  const href = (format: "csv" | "xlsx") => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.set("format", format);
    return `/api/clients/export?${params.toString()}`;
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <DownloadIcon /> Exporter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          Clients affichés (filtres appliqués)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={href("xlsx")} download>
            Excel (.xlsx)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={href("csv")} download>
            CSV (.csv)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
