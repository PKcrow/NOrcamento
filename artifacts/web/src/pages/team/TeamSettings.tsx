import { useState } from "react";
import { useGetTeam } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Copy, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";

export function TeamSettings() {
  const { data: team, isLoading } = useGetTeam();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded"></div>
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  if (!team) return null;

  const copyInviteCode = () => {
    navigator.clipboard.writeText(team.inviteCode);
    toast({
      title: "Código copiado!",
      description: "Envie este código para seus colegas de equipe.",
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Sua Equipe</h1>
        <p className="text-gray-500 mt-1">Gerencie os membros da equipe e os convites.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Detalhes da Equipe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Nome</p>
              <p className="text-lg font-semibold">{team.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Criada em</p>
              <p className="text-md">{formatDate(team.createdAt)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Adicionar Membros</CardTitle>
            <CardDescription>
              Compartilhe o código de convite abaixo para que outros membros possam entrar na sua equipe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 items-center">
              <Input value={team.inviteCode} readOnly className="font-mono text-lg tracking-wider font-bold bg-gray-50 text-center" />
              <Button onClick={copyInviteCode} variant="secondary" className="gap-2 shrink-0">
                <Copy className="w-4 h-4" /> Copiar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Users className="w-5 h-5 text-gray-500" />
          <CardTitle>Membros da Equipe ({team.members.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Papel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.members.map(member => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell className="text-gray-500">{member.email}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                      {member.role === 'owner' ? 'Proprietário' : 'Membro'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
