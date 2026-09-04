import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "@/services/errors";

import { loginSchema, type LoginFormValues } from "./schemas";
import { useAuth } from "./useAuth";

interface LocationState {
  from?: { pathname: string };
}

/**
 * Login form logic, kept out of the component (brief 24).
 *
 * Also maps backend field errors onto the form, so a validation failure
 * lands on the right input instead of only in a banner.
 */
export function useLoginForm(expectedArea: "parent" | "staff") {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await login(values);

      // Route by the role the server reported, not by which form was used:
      // a staff member using the parent form still lands correctly.
      const home = user.role === "PARENT" ? "/parent" : "/staff";
      const requested = (location.state as LocationState | null)?.from?.pathname;

      // Only honour a remembered destination that belongs to this user's
      // area, so a parent is never bounced into a staff URL.
      const destination =
        requested !== undefined && requested.startsWith(home) ? requested : home;

      navigate(destination, { replace: true });
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError({
              code: "unknown",
              message: "Une erreur inattendue est survenue.",
              status: 0,
            });

      for (const [field, messages] of Object.entries(apiError.fieldErrors)) {
        if (field === "email" || field === "password") {
          form.setError(field, { message: messages[0] ?? "" });
        }
      }

      setFormError(apiError.message);
    }
  });

  return { form, onSubmit, formError, expectedArea };
}
