"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import type { StockItem } from "@/lib/types/stock";

interface LowStockAlertProps {
  items: StockItem[];
}

export function LowStockAlert({ items }: LowStockAlertProps) {
  const t = useTranslations();

  if (items.length === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-800">
          {t("stock.lowStockAlertTitle", { count: items.length })}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {items.slice(0, 8).map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/stock/${item.id}`}
              className="text-xs font-medium text-amber-700 underline-offset-2 hover:underline"
            >
              {item.name} ({item.currentStock} {item.unit})
            </Link>
          ))}
          {items.length > 8 && (
            <span className="text-xs text-amber-600">{t("stock.andMore", { count: items.length - 8 })}</span>
          )}
        </div>
      </div>
    </div>
  );
}
