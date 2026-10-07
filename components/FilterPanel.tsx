"use client";

import * as React from "react";
import { Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FilterTriggerProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export function FilterTrigger({ onClick, label = "Filter", className }: FilterTriggerProps) {
  return (
    <Button type="button" variant="outline" className={cn("md:hidden", className)} onClick={onClick}>
      <Search className="h-4 w-4 me-1" aria-hidden="true" />
      {label}
    </Button>
  );
}

interface FilterPanelProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClear?: () => void;
  className?: string;
  children: React.ReactNode;
}

export function FilterPanel({ title, open, onOpenChange, onClear, className, children }: FilterPanelProps) {
  return (
    <>
      <Card className={cn("hidden md:block", className)}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">{children}</div>
          <DialogFooter>
            {onClear && (
              <Button type="button" variant="outline" onClick={onClear}>
                <X className="h-4 w-4" aria-hidden="true" />
                Hapus filter
              </Button>
            )}
            <DialogClose render={<Button type="button" />}>
              <Check className="h-4 w-4" aria-hidden="true" />
              Terapkan
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
