import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const SUPPORT_EMAIL = 'giancarlo.macedo.espindola@gmail.com';

const sections = [
  {
    title: '1. Visão geral',
    body: 'Esta política explica como o Gestão de Autônomos trata os dados necessários para organizar clientes, orçamentos, ordens de serviço e equipes. Ao utilizar o aplicativo ou o site, você concorda com estas práticas.',
  },
  {
    title: '2. Dados tratados',
    body: 'Podemos tratar dados de cadastro e autenticação, como nome e e-mail; dados de clientes, contatos e empresas inseridos pelo usuário; orçamentos, serviços, tarefas, pagamentos e observações; mensagens incluídas em respostas a orçamentos compartilhados; e dados técnicos mínimos necessários para segurança, funcionamento e prevenção de fraudes.',
  },
  {
    title: '3. Finalidades',
    body: 'Os dados são usados para criar e manter contas, disponibilizar os recursos do serviço, compartilhar orçamentos quando solicitado pelo usuário, proteger o acesso às informações e prestar suporte.',
  },
  {
    title: '4. Compartilhamento e armazenamento',
    body: 'Os dados podem ser processados por fornecedores indispensáveis para autenticação, hospedagem e infraestrutura do serviço. Não vendemos dados pessoais. O compartilhamento ocorre apenas quando necessário para fornecer o serviço, cumprir obrigações legais ou por solicitação do usuário.',
  },
  {
    title: '5. Segurança e retenção',
    body: 'Adotamos medidas técnicas e organizacionais razoáveis para proteger as informações. Os dados são mantidos enquanto a conta ou a equipe estiver ativa, ou pelo período necessário para cumprir obrigações legais e resolver eventuais solicitações.',
  },
  {
    title: '6. Seus direitos',
    body: 'Você pode solicitar acesso, correção, atualização ou exclusão de dados pessoais, observadas as hipóteses de retenção previstas em lei. Para isso, entre em contato pelo canal abaixo.',
  },
  {
    title: '7. Alterações nesta política',
    body: 'Esta política pode ser atualizada para refletir melhorias no serviço ou mudanças legais. A versão vigente estará sempre disponível nesta página.',
  },
];

export default function PoliticaDePrivacidadeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.hero, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.iconCircle, { backgroundColor: theme.primary + '18' }]}>
          <Ionicons name="shield-checkmark-outline" size={28} color={theme.primary} />
        </View>
        <Text style={[styles.title, { color: theme.foreground }]}>Política de Privacidade</Text>
        <Text style={[styles.updated, { color: theme.mutedForeground }]}>
          Última atualização: 20 de agosto de 2026
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.foreground }]}>{section.title}</Text>
            <Text style={[styles.body, { color: theme.mutedForeground }]}>{section.body}</Text>
          </View>
        ))}

        <View style={[styles.contact, { backgroundColor: theme.primary + '0d', borderColor: theme.primary + '33' }]}>
          <Text style={[styles.sectionTitle, { color: theme.foreground }]}>8. Contato</Text>
          <Text style={[styles.body, { color: theme.mutedForeground }]}>
            Para dúvidas sobre privacidade ou solicitações relacionadas aos seus dados, escreva para:
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            <Text style={[styles.email, { color: theme.primary }]}>{SUPPORT_EMAIL}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  hero: { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: 'center' },
  iconCircle: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', textAlign: 'center' },
  updated: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 6 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 7 },
  body: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 22 },
  contact: { borderRadius: 12, borderWidth: 1, padding: 14 },
  email: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', marginTop: 8 },
});