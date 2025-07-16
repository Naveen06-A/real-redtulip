// utils/businessPlanUtils.ts
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

export const saveBusinessPlan = async (user: any, targets: BusinessPlanTargets, setTargets: any, setSaving: any) => {
  if (!user?.id) return;

  setSaving(true);
  try {
    const planData = {
      ...targets,
      agent_id: user.id,
      updated_at: new Date().toISOString()
    };

    if (targets.id) {
      const { error } = await supabase
        .from('agent_business_plans')
        .update(planData)
        .eq('id', targets.id);
      
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('agent_business_plans')
        .insert([{ ...planData, created_at: new Date().toISOString() }])
        .select()
        .single();
      
      if (error) throw error;
      setTargets(data);
    }

    toast.success('Business plan saved successfully!');
  } catch (error: any) {
    console.error('Error saving business plan:', error);
    toast.error('Failed to save business plan');
  } finally {
    setSaving(false);
  }
};