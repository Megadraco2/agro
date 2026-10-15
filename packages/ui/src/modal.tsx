'use client';
import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from './utils';

export function Modal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-foreground/40" />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-xl border border-border bg-white p-6 shadow-lg',
          )}
        >
          <Dialog.Title className="mb-4 text-lg font-semibold">
            {title}
          </Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
