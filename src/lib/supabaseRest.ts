import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/config";

const supabaseUrl = SUPABASE_URL;
const supabasePublishableKey = SUPABASE_PUBLISHABLE_KEY;

type CreateClassPayload = {
  teacherId: string;
  name: string;
  subject: string;
};

export type CreatedClassRow = {
  id: string;
  teacher_id: string;
  name: string;
  subject: string;
  join_code: string;
  created_at: string;
  updated_at: string;
};

type ApiErrorBody = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

const getRequiredConfig = () => {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Database connection is not configured. Please check the app environment settings.");
  }

  return { supabaseUrl, supabasePublishableKey };
};

const getAuthHeaders = async () => {
  const { supabaseUrl, supabasePublishableKey } = getRequiredConfig();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error("Your sign-in session could not be verified. Please sign in again.");
  }

  return {
    url: supabaseUrl,
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "Accept-Profile": "public",
      "Content-Profile": "public",
    },
  };
};

const readApiError = async (response: Response) => {
  try {
    return await response.json() as ApiErrorBody;
  } catch {
    return { message: response.statusText };
  }
};

export const reloadSchemaCache = async () => {
  try {
    await supabase.rpc("reload_schema_cache");
  } catch (error) {
    console.warn("Schema cache refresh request failed:", error);
  }
};

export const createClassViaRest = async ({ teacherId, name, subject }: CreateClassPayload) => {
  const { url, headers } = await getAuthHeaders();

  const response = await fetch(`${url}/rest/v1/classes?select=id,teacher_id,name,subject,join_code,created_at,updated_at`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      teacher_id: teacherId,
      name,
      subject,
    }),
  });

  if (!response.ok) {
    const apiError = await readApiError(response);
    const error = new Error(apiError.message || "The database request failed.") as Error & ApiErrorBody & { status: number };
    error.code = apiError.code;
    error.details = apiError.details;
    error.hint = apiError.hint;
    error.status = response.status;
    throw error;
  }

  const rows = await response.json() as CreatedClassRow[];
  return rows[0];
};
