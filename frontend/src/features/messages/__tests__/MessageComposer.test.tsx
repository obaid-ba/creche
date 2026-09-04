import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/services/errors";

import { MessageComposer } from "../components/MessageComposer";

describe("MessageComposer", () => {
  it("sends the trimmed body and clears the field", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<MessageComposer onSend={onSend} isPending={false} />);

    const field = screen.getByLabelText(/votre message/i);
    await userEvent.type(field, "  Merci beaucoup  ");
    await userEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    expect(onSend).toHaveBeenCalledWith("Merci beaucoup");
    expect(field).toHaveValue("");
  });

  it("cannot submit an empty message", async () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} isPending={false} />);

    expect(screen.getByRole("button", { name: /envoyer/i })).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("keeps the text when sending fails, so nothing is lost", async () => {
    const onSend = vi.fn().mockRejectedValue(
      new ApiError({
        code: "permission_denied",
        message: "L'envoi de messages n'est pas activé pour votre compte.",
        status: 403,
      }),
    );
    render(<MessageComposer onSend={onSend} isPending={false} />);

    await userEvent.type(screen.getByLabelText(/votre message/i), "Bonjour");
    await userEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/pas activé/i);
    expect(screen.getByLabelText(/votre message/i)).toHaveValue("Bonjour");
  });

  it("explains up front when the account cannot send", () => {
    render(
      <MessageComposer
        onSend={vi.fn()}
        isPending={false}
        disabledReason="L'envoi de messages n'est pas activé pour votre compte."
      />,
    );

    expect(screen.getByText(/pas activé/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /envoyer/i }),
    ).not.toBeInTheDocument();
  });
});
