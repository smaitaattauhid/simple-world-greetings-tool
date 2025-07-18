
import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';

interface Student {
  id: string;
  name: string;
  class_name: string;
  nik?: string;
  nis?: string;
}

interface StudentSearchComboboxProps {
  onStudentSelect: (searchTerm: string) => void;
  placeholder?: string;
}

export const StudentSearchCombobox: React.FC<StudentSearchComboboxProps> = ({
  onStudentSelect,
  placeholder = "Cari siswa..."
}) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  const searchStudents = async (query: string) => {
    if (!query.trim()) {
      setStudents([]);
      return;
    }

    try {
      setLoading(true);
      console.log('StudentSearch: Searching for:', query);

      // Search in both children and students tables
      const [childrenResponse, studentsResponse] = await Promise.all([
        supabase
          .from('children')
          .select('id, name, class_name, nik, nis')
          .or(`name.ilike.%${query}%,class_name.ilike.%${query}%,nik.ilike.%${query}%,nis.ilike.%${query}%`)
          .limit(10),
        supabase
          .from('students')
          .select('id, name, class_name, nik, nis')
          .or(`name.ilike.%${query}%,class_name.ilike.%${query}%,nik.ilike.%${query}%,nis.ilike.%${query}%`)
          .limit(10)
      ]);

      const combinedResults: Student[] = [];
      
      // Add children results
      if (childrenResponse.data) {
        combinedResults.push(...childrenResponse.data);
      }
      
      // Add students results (avoid duplicates by name)
      if (studentsResponse.data) {
        const existingNames = new Set(combinedResults.map(s => s.name.toLowerCase()));
        const uniqueStudents = studentsResponse.data.filter(
          student => !existingNames.has(student.name.toLowerCase())
        );
        combinedResults.push(...uniqueStudents);
      }

      // Sort by name
      combinedResults.sort((a, b) => a.name.localeCompare(b.name));
      
      console.log('StudentSearch: Found students:', combinedResults.length);
      setStudents(combinedResults);
    } catch (error) {
      console.error('StudentSearch: Error searching students:', error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchStudents(searchValue);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  const handleSelect = (student: Student) => {
    console.log('StudentSearch: Selected student:', student);
    // Use the student's name as search term for the main search
    onStudentSelect(student.name);
    setOpen(false);
    setSearchValue(student.name);
  };

  const formatStudentDisplay = (student: Student) => {
    const identifiers = [];
    if (student.nik) identifiers.push(`NIK: ${student.nik}`);
    if (student.nis) identifiers.push(`NIS: ${student.nis}`);
    
    return (
      <div className="flex flex-col">
        <span className="font-medium">{student.name}</span>
        <span className="text-sm text-gray-500">
          Kelas: {student.class_name}
          {identifiers.length > 0 && ` • ${identifiers.join(' • ')}`}
        </span>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <div className="flex items-center">
            <Search className="h-4 w-4 mr-2" />
            {searchValue || placeholder}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Ketik nama, kelas, NIK, atau NIS..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Mencari..." : "Tidak ada siswa ditemukan."}
            </CommandEmpty>
            {students.length > 0 && (
              <CommandGroup>
                {students.map((student) => (
                  <CommandItem
                    key={`${student.id}-${student.name}`}
                    value={student.name}
                    onSelect={() => handleSelect(student)}
                    className="cursor-pointer p-3"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        searchValue === student.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {formatStudentDisplay(student)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
