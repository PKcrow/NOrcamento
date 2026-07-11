import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateTeam, useJoinTeam, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users } from "lucide-react";

export function Onboarding() {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  
  const createTeam = useCreateTeam();
  const joinTeam = useJoinTeam();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useGetMe();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    createTeam.mutate({ data: { name } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Equipe criada com sucesso!" });
      },
      onError: () => {
        toast({ title: "Erro ao criar equipe", variant: "destructive" });
      }
    });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    
    joinTeam.mutate({ data: { inviteCode } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Bem-vindo à equipe!" });
      },
      onError: () => {
        toast({ title: "Código inválido ou equipe não encontrada", variant: "destructive" });
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Bem-vindo, {me?.name?.split(' ')[0] || 'Autônomo'}!</h1>
        <p className="text-gray-500 mt-2">Para começar, você precisa configurar sua equipe de trabalho.</p>
      </div>

      <Card className="w-full max-w-md shadow-xl border-gray-200">
        <div className="flex border-b">
          <button
            className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${mode === "create" ? "border-b-2 border-primary text-primary" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setMode("create")}
          >
            <Building2 className="w-4 h-4" /> Criar Equipe
          </button>
          <button
            className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${mode === "join" ? "border-b-2 border-primary text-primary" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setMode("join")}
          >
            <Users className="w-4 h-4" /> Entrar com Código
          </button>
        </div>

        <CardContent className="pt-6">
          {mode === "create" ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Nome do seu Negócio / Equipe</Label>
                <Input
                  id="teamName"
                  placeholder="Ex: Carlos Elétrica, Studio Design..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={createTeam.isPending}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createTeam.isPending || !name.trim()}>
                {createTeam.isPending ? "Criando..." : "Criar minha Equipe"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteCode">Código de Convite</Label>
                <Input
                  id="inviteCode"
                  placeholder="Cole o código aqui..."
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  disabled={joinTeam.isPending}
                />
                <p className="text-xs text-gray-500">Peça o código para o administrador da sua equipe.</p>
              </div>
              <Button type="submit" className="w-full" disabled={joinTeam.isPending || !inviteCode.trim()}>
                {joinTeam.isPending ? "Verificando..." : "Entrar na Equipe"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
