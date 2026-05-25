import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import supplierAPI, {
  SupplierApiError,
  type AuthenticatedAppUser,
} from "../services/supplierOnboardingAPI";

type SignInInput = {
  email: string;
  password: string;
};

type AuthContextValue = {
  user: AuthenticatedAppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedAppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const hydrateSession = async () => {
      const token = supplierAPI.getStoredAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await supplierAPI.getCurrentUser();
        if (!cancelled) {
          setUser(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          supplierAPI.setAuthToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    hydrateSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      async signIn(input) {
        const response = await supplierAPI.signIn(input.email, input.password);
        supplierAPI.setAuthToken(response.data.access_token);
        setUser(response.data.user);
      },
      signOut() {
        supplierAPI.setAuthToken(null);
        setUser(null);
      },
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function getReadableAuthError(error: unknown) {
  if (error instanceof SupplierApiError) {
    if (Array.isArray(error.details) && error.details.length > 0) {
      const firstIssue = error.details[0] as {
        field?: string;
        message?: string;
      };

      if (firstIssue?.field && firstIssue?.message) {
        const fieldLabel = firstIssue.field
          .split(".")
          .filter(Boolean)
          .pop()
          ?.replace(/_/g, " ");

        return fieldLabel
          ? `${fieldLabel}: ${firstIssue.message}`
          : firstIssue.message;
      }
    }

    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "We couldn't sign you in. Please try again.";
}
