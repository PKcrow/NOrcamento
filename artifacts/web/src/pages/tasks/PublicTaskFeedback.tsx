import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetPublicTaskFeedback,
  useRespondPublicTaskFeedback,
} from "@workspace/api-client-react";
import type { ApiError } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, Loader2, Star } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function PublicTaskFeedback() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError, error } = useGetPublicTaskFeedback(token);
  const responseMutation = useRespondPublicTaskFeedback();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const status = (error as ApiError | undefined)?.status;
  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            {status === 404 ? "Avaliação já respondida" : "Não foi possível abrir a avaliação"}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {status === 404
              ? "Este link fica indisponível depois que a avaliação é enviada."
              : "Verifique o link e tente novamente mais tarde."}
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = () => {
    if (!rating || responseMutation.isPending) return;
    responseMutation.mutate(
      { token, data: { rating, comment: comment.trim() || undefined } },
      { onSuccess: () => setSubmitted(true) },
    );
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Obrigado pela avaliação!</h1>
          <p className="mt-2 text-sm text-gray-500">
            Sua opinião ajuda {data.company?.name ?? "a empresa"} a melhorar cada vez mais.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <main className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="h-2 bg-primary" />
        <div className="space-y-7 p-6 sm:p-9">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Star className="h-7 w-7 fill-primary text-primary" />
            </div>
            <p className="text-sm font-medium text-primary">{data.company?.name ?? "Prestador de serviço"}</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">Como foi o serviço?</h1>
            <p className="mt-2 text-sm text-gray-500">
              Avalie o atendimento de {data.task.clientName ?? "seu serviço"} em poucos segundos.
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4 text-center">
            <p className="font-semibold text-gray-900">{data.task.title}</p>
            <p className="mt-1 text-xs text-gray-500">Ordem de serviço concluída</p>
          </div>

          <div className="space-y-3 text-center">
            <p className="text-sm font-semibold text-gray-700">Sua nota</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} estrela${value > 1 ? "s" : ""}`}
                  onClick={() => setRating(value)}
                  className="rounded-full p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <Star className={`h-9 w-9 ${value <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              {rating ? `${rating} de 5 estrelas` : "Selecione de 1 a 5 estrelas"}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="feedback-comment" className="text-sm font-semibold text-gray-700">
              Comentário <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <Textarea
              id="feedback-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Conte como foi sua experiência..."
              rows={4}
              maxLength={2000}
            />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={!rating || responseMutation.isPending}>
            {responseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enviar avaliação
          </Button>
          {responseMutation.isError && (
            <p className="text-center text-sm text-red-600">Não foi possível enviar. O link pode já ter sido respondido.</p>
          )}
        </div>
      </main>
    </div>
  );
}