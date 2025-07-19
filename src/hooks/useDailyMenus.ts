
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface DailyMenu {
  id: string;
  date: string;
  food_item_id: string;
  price: number;
  is_available: boolean;
  max_quantity: number | null;
  current_quantity: number;
  food_items: {
    name: string;
    description: string;
    image_url: string;
    category: string;
  };
}

export const useDailyMenus = () => {
  const [dailyMenus, setDailyMenus] = useState<DailyMenu[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDailyMenus = async (date: Date) => {
    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // First check if there's a schedule for this date
      const { data: schedule, error: scheduleError } = await supabase
        .from('order_schedules')
        .select('*')
        .eq('date', dateStr)
        .maybeSingle();
      
      if (scheduleError && scheduleError.code !== 'PGRST116') {
        console.error('Error fetching schedule:', scheduleError);
      }

      console.log('Schedule for date:', dateStr, schedule);
      
      // If no specific schedule exists or date is not blocked, show all available menu items
      if (!schedule || !schedule.is_blocked) {
        const { data: menuItems, error: menuError } = await supabase
          .from('menu_items')
          .select(`
            id,
            name,
            description,
            image_url,
            price,
            category_id,
            is_available,
            categories(name)
          `)
          .eq('is_available', true);

        if (menuError) {
          console.error('Error fetching menu items:', menuError);
          setDailyMenus([]);
        } else {
          // Transform menu items to match DailyMenu interface
          const transformedMenus: DailyMenu[] = (menuItems || []).map(item => ({
            id: `daily-${item.id}-${dateStr}`,
            date: dateStr,
            food_item_id: item.id,
            price: item.price,
            is_available: item.is_available,
            max_quantity: null,
            current_quantity: 0,
            food_items: {
              name: item.name,
              description: item.description || '',
              image_url: item.image_url || '/placeholder.svg',
              category: item.categories?.name || 'Uncategorized'
            }
          }));
          
          setDailyMenus(transformedMenus);
          console.log('Fetched menu items for date:', dateStr, transformedMenus.length);
        }
      } else {
        // Date is blocked, no menu available
        setDailyMenus([]);
        console.log('Date is blocked, no menu available');
      }
    } catch (error) {
      console.error('Error in fetchDailyMenus:', error);
      setDailyMenus([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    dailyMenus,
    loading,
    fetchDailyMenus
  };
};
