import { Printer } from 'lucide-react';

export default function PrintButton({ label = 'طباعة' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm shadow-sm print:hidden"
    >
      <Printer className="w-4 h-4" />
      {label}
    </button>
  );
}
