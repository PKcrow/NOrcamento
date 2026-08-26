import { useState } from "react";
import {
  useGetMe,
  useGetTeam,
  useListTeams,
  useSwitchTeam,
  useCreateTeam,
  useJoinTeam,
  useUpdateTeamMemberRole,
  useRemoveTeamMember,
  getGetMeQueryKey,
  getListTeamsQueryKey,
  getGetTeamQueryKey,
} from "@workspace/api-client-react";
import type { ApiError, TeamMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus as PlusIcon,
  UserPlus,
  ArrowRightLeft,
  Copy,
  Users,
  MoreHorizontal,
  Shield,
  User as UserIcon,
  Trash2,
} from "lucide-react";

export function EquipesPage() {
  const { data: me } = useGetMe();
  const { data: team } = useGetTeam();
  const { data: allTeams, isLoading } = useListTeams();
  const switchTeam = useSwitchTeam();
  const createTeam = useCreateTeam();
  const joinTeam = useJoinTeam();
  const updateMemberRole = useUpdateTeamMemberRole();
  const removeMember = useRemoveTeamMember();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [teamDialog, setTeamDialog] = useState<"create" | "join" | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  const isOwner = me?.role === "owner";

  const invalidate = () => {
    queryClient.clear();
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
  };

  const invalidateTeam = () => {
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey() });
  };

  const serverErrorMessage = (error: unknown, fallback: string): string => {
    const data = (error as ApiError | undefined)?.data as
      | { message?: string; detail?: string; error?: string; title?: string }
      | string
      | null
      | undefined;
    if (typeof data === "string") return data.trim() || fallback;
    if (data && typeof data === "object") {
      return (
        data.message ?? data.detail ?? data.error ?? data.title ?? fallback
      );
    }
    return fallback;
  };

  const handleChangeRole = (member: TeamMember, role: "owner" | "member") => {
    if (member.role === role) return;
    updateMemberRole.mutate(
      { userId: member.id, data: { role } },
      {
        onSuccess: () => {
          invalidateTeam();
          toast({
            title:
              role === "owner"
                ? `${member.name} agora é Dono`
                : `${member.name} agora é Membro`,
          });
        },
        onError: (error) =>
          toast({
            title: "Não foi possível alterar o papel",
            description: serverErrorMessage(
              error,
              "Tente novamente mais tarde.",
            ),
            variant: "destructive",
          }),
      },
    );
  };

  const handleRemoveMember = () => {
    if (!memberToRemove) return;
    const member = memberToRemove;
    const removingSelf = member.id === me?.id;
    removeMember.mutate(
      { userId: member.id },
      {
        onSuccess: () => {
          setMemberToRemove(null);
          if (removingSelf) {
            // Backend switches active team; refresh everything.
            invalidate();
            toast({ title: "Você saiu da equipe." });
          } else {
            invalidateTeam();
            toast({ title: `${member.name} foi removido da equipe.` });
          }
        },
        onError: (error) =>
          toast({
            title: "Não foi possível remover o membro",
            description: serverErrorMessage(
              error,
              "Tente novamente mais tarde.",
            ),
            variant: "destructive",
          }),
      },
    );
  };

  const handleSwitchTeam = (teamId: string) => {
    if (teamId === me?.teamId) return;
    switchTeam.mutate(
      { data: { teamId } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Equipe ativada com sucesso!" });
        },
        onError: () =>
          toast({ title: "Erro ao trocar equipe", variant: "destructive" }),
      },
    );
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = (
      new FormData(e.currentTarget).get("name") as string
    ).trim();
    if (!name) return;
    createTeam.mutate(
      { data: { name } },
      {
        onSuccess: () => {
          invalidate();
          setTeamDialog(null);
          toast({ title: `Equipe "${name}" criada e ativada!` });
        },
        onError: () =>
          toast({ title: "Erro ao criar equipe", variant: "destructive" }),
      },
    );
  };

  const handleJoin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const inviteCode = (
      new FormData(e.currentTarget).get("inviteCode") as string
    ).trim();
    if (!inviteCode) return;
    joinTeam.mutate(
      { data: { inviteCode } },
      {
        onSuccess: (data) => {
          invalidate();
          setTeamDialog(null);
          toast({ title: `Entrou na equipe "${data.name}"!` });
        },
        onError: () =>
          toast({
            title: "Código inválido ou equipe não encontrada",
            variant: "destructive",
          }),
      },
    );
  };

  const copyInviteCode = () => {
    if (!team) return;
    navigator.clipboard.writeText(team.inviteCode);
    toast({
      title: "Código copiado!",
      description: "Envie este código para seus colegas de equipe.",
    });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Equipes
          </h1>
          <p className="text-gray-500 mt-1">
            Gerencie e alterne entre suas equipes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setTeamDialog("join")}
          >
            <UserPlus className="w-4 h-4" /> Entrar com código
          </Button>
          <Button className="gap-2" onClick={() => setTeamDialog("create")}>
            <PlusIcon className="w-4 h-4" /> Nova equipe
          </Button>
        </div>
      </div>

      {/* All teams the user belongs to */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !allTeams || allTeams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Você ainda não faz parte de nenhuma equipe.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {allTeams.map((t) => {
            const isActive = t.id === me?.teamId;
            return (
              <Card
                key={t.id}
                className={
                  isActive ? "border-primary ring-1 ring-primary" : ""
                }
              >
                <CardContent className="pt-4 pb-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{t.name}</p>
                      {isActive && (
                        <Badge className="text-[10px] h-4 px-1.5 shrink-0">
                          Ativa
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {t.role === "owner" ? "Dono" : "Membro"}
                    </p>
                  </div>
                  {!isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 shrink-0"
                      disabled={switchTeam.isPending}
                      onClick={() => handleSwitchTeam(t.id)}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Ativar
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Active team details */}
      {team && (
        <>
          <div className="border-t pt-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Equipe ativa — {team.name}
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Invite code (visible only to owners — backend masks it for members) */}
            {team.inviteCode && (
            <Card>
              <CardHeader>
                <CardTitle>Código de convite</CardTitle>
                <CardDescription>
                  Compartilhe para que outros membros entrem nesta equipe.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 items-center">
                  <Input
                    value={team.inviteCode}
                    readOnly
                    className="font-mono text-lg tracking-wider font-bold bg-gray-50 text-center"
                  />
                  <Button
                    onClick={copyInviteCode}
                    variant="secondary"
                    className="gap-2 shrink-0"
                  >
                    <Copy className="w-4 h-4" /> Copiar
                  </Button>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Role */}
            <Card>
              <CardHeader>
                <CardTitle>Seu papel</CardTitle>
                <CardDescription>
                  Nível de acesso nesta equipe.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Badge
                  variant={me?.role === "owner" ? "default" : "secondary"}
                  className="text-sm px-3 py-1"
                >
                  {me?.role === "owner" ? "Dono" : "Membro"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Members table */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Users className="w-5 h-5 text-gray-500" />
              <CardTitle>Membros ({team.members.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className={isOwner ? "" : "text-right"}>
                      Papel
                    </TableHead>
                    {isOwner && (
                      <TableHead className="text-right w-16">Ações</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.members.map((member) => {
                    const isSelf = member.id === me?.id;
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.name}
                          {isSelf && (
                            <span className="text-gray-400 font-normal">
                              {" "}
                              (você)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {member.email}
                        </TableCell>
                        <TableCell className={isOwner ? "" : "text-right"}>
                          <Badge
                            variant={
                              member.role === "owner" ? "default" : "secondary"
                            }
                          >
                            {member.role === "owner" ? "Dono" : "Membro"}
                          </Badge>
                        </TableCell>
                        {isOwner && (
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label={`Ações para ${member.name}`}
                                  disabled={
                                    updateMemberRole.isPending ||
                                    removeMember.isPending
                                  }
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Papel</DropdownMenuLabel>
                                <DropdownMenuItem
                                  disabled={member.role === "owner"}
                                  onSelect={() =>
                                    handleChangeRole(member, "owner")
                                  }
                                >
                                  <Shield className="w-4 h-4" />
                                  Tornar Dono
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={member.role === "member"}
                                  onSelect={() =>
                                    handleChangeRole(member, "member")
                                  }
                                >
                                  <UserIcon className="w-4 h-4" />
                                  Tornar Membro
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onSelect={() => setMemberToRemove(member)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  {isSelf ? "Sair da equipe" : "Remover"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialogs */}
      <Dialog
        open={teamDialog === "create"}
        onOpenChange={(o) => !o && setTeamDialog(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-primary" /> Nova equipe
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="new-team-name">Nome da equipe</Label>
              <Input
                id="new-team-name"
                name="name"
                required
                placeholder="Ex: Carlos Elétrica"
              />
            </div>
            <p className="text-xs text-gray-500">
              Após criar, a nova equipe será automaticamente ativada.
            </p>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={createTeam.isPending}>
                {createTeam.isPending ? "Criando…" : "Criar e ativar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={teamDialog === "join"}
        onOpenChange={(o) => !o && setTeamDialog(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Entrar com código
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleJoin} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="join-invite-code">Código de convite</Label>
              <Input
                id="join-invite-code"
                name="inviteCode"
                required
                placeholder="Ex: AB12CD34"
                className="font-mono tracking-widest uppercase"
              />
              <p className="text-xs text-gray-500">
                Peça o código para o administrador da equipe.
              </p>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={joinTeam.isPending}>
                {joinTeam.isPending ? "Verificando…" : "Entrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove member confirmation */}
      <AlertDialog
        open={memberToRemove !== null}
        onOpenChange={(o) => !o && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {memberToRemove?.id === me?.id
                ? "Sair da equipe?"
                : `Remover ${memberToRemove?.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove?.id === me?.id
                ? "Você perderá o acesso a esta equipe. Se você for o único dono, esta ação não será permitida."
                : `${memberToRemove?.name} perderá o acesso a esta equipe. Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMember.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRemoveMember();
              }}
              disabled={removeMember.isPending}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {removeMember.isPending
                ? "Removendo…"
                : memberToRemove?.id === me?.id
                  ? "Sair"
                  : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
