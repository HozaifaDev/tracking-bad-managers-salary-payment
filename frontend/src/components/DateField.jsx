import * as React from 'react';
import { format, parse } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import { enGB } from 'date-fns/locale';
import 'react-day-picker/style.css';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog';
import { Calendar } from 'lucide-react';

/** YYYY-MM-DD ↔ calendar popover (react-day-picker). */
export function DateField({ value, onChange, label }) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className={cn('w-full justify-start text-left font-normal')}>
            <Calendar className="mr-2 h-4 w-4" />
            {value ? format(selected, 'dd MMM yyyy', { locale: enGB }) : 'Pick date'}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-fit">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (d) {
                onChange(format(d, 'yyyy-MM-dd'));
                setOpen(false);
              }
            }}
            locale={enGB}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
