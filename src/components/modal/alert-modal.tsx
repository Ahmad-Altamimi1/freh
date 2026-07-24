'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  /**
   * Wording. Optional so existing call sites keep working, but worth passing:
   * a confirmation that names what is about to be destroyed is the difference
   * between a considered click and a reflex.
   */
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function AlertModal({
  isOpen,
  onClose,
  onConfirm,
  loading,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel'
}: AlertModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <Modal title={title} description={description} isOpen={isOpen} onClose={onClose}>
      {/* `gap` rather than `space-x`: the latter is direction-aware in
          Tailwind v4 but still keys off the first child, which reads oddly
          when the buttons are mirrored. */}
      <div className='flex w-full items-center justify-end gap-2 pt-6'>
        <Button disabled={loading} variant='outline' onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button disabled={loading} variant='destructive' onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
