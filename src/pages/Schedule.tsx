import { Calendar as CalendarIcon } from 'lucide-react';

export function Schedule() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Publishing Schedule</h1>
        <p className="text-gray-600">Manage your content calendar</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Calendar View Coming Soon</h3>
        <p className="text-gray-600">Schedule and manage your posts with drag-and-drop calendar</p>
      </div>
    </div>
  );
}
