import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type DatePickerFieldProps = {
  value: Date | null;
  onChange: (date: Date) => void;
  accessibilityLabel: string;
  placeholder?: string;
};

type TimePickerFieldProps = {
  value: string;
  onChange: (time: string) => void;
  accessibilityLabel: string;
};

const WEEKDAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
const TIME_ROW_HEIGHT = 48;
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, '0'),
);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) =>
  String(minute).padStart(2, '0'),
);

type TimePart = 'hour' | 'minute';

function parseTime(value: string): [string, string] {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    return ['00', '00'];
  }
  return [match[1], match[2]];
}

function toScheduledDateTime(date: Date | null, time: string): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!date || Number.isNaN(date.getTime()) || !match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  const dateTime = new Date(date);
  dateTime.setHours(hour, minute, 0, 0);
  return dateTime;
}

export function isScheduleEndBeforeStart(
  startDate: Date | null,
  startTime: string,
  endDate: Date | null,
  endTime: string,
): boolean {
  const start = toScheduledDateTime(startDate, startTime);
  const end = toScheduledDateTime(endDate, endTime);
  return Boolean(start && end && end.getTime() < start.getTime());
}

function atMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function sameDay(a: Date | null, b: Date): boolean {
  return Boolean(
    a &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate(),
  );
}

function displayDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function DatePickerField({
  value,
  onChange,
  accessibilityLabel,
  placeholder = 'Selecionar data',
}: DatePickerFieldProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    atMonthStart(value ?? new Date()),
  );

  const firstDayOffset = (visibleMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();
  const calendarCells: Array<number | null> = [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const monthLabel = visibleMonth.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  const today = new Date();

  const openPicker = () => {
    Keyboard.dismiss();
    setVisibleMonth(atMonthStart(value ?? new Date()));
    setIsOpen(true);
  };

  const chooseDay = (day: number) => {
    onChange(
      new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth(),
        day,
        12,
        0,
        0,
        0,
      ),
    );
    setIsOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={openPicker}
        style={[
          styles.fieldButton,
          { borderColor: theme.border, backgroundColor: theme.card },
        ]}
      >
        <Ionicons name="calendar-outline" size={18} color={theme.mutedForeground} />
        <Text
          numberOfLines={1}
          style={[
            styles.fieldText,
            { color: value ? theme.foreground : theme.mutedForeground },
          ]}
        >
          {value ? displayDate(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.mutedForeground} />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar calendário"
            onPress={() => setIsOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.sheet, { backgroundColor: theme.card }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.foreground }]}>
                  Selecionar data
                </Text>
                <Text style={[styles.sheetSubtitle, { color: theme.mutedForeground }]}>
                  Toque no dia do serviço
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fechar calendário"
                onPress={() => setIsOpen(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color={theme.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.monthHeader}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Mês anterior"
                onPress={() =>
                  setVisibleMonth(
                    (current) =>
                      new Date(current.getFullYear(), current.getMonth() - 1, 1, 12),
                  )
                }
                style={styles.monthArrow}
              >
                <Ionicons name="chevron-back" size={20} color={theme.foreground} />
              </TouchableOpacity>
              <Text style={[styles.monthLabel, { color: theme.foreground }]}>
                {monthLabel}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Próximo mês"
                onPress={() =>
                  setVisibleMonth(
                    (current) =>
                      new Date(current.getFullYear(), current.getMonth() + 1, 1, 12),
                  )
                }
                style={styles.monthArrow}
              >
                <Ionicons name="chevron-forward" size={20} color={theme.foreground} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarGrid}>
              {WEEKDAYS.map((weekday) => (
                <View key={weekday} style={styles.calendarCell}>
                  <Text style={[styles.weekday, { color: theme.mutedForeground }]}>
                    {weekday}
                  </Text>
                </View>
              ))}
              {calendarCells.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={styles.calendarCell} />;
                }
                const date = new Date(
                  visibleMonth.getFullYear(),
                  visibleMonth.getMonth(),
                  day,
                  12,
                );
                const selected = sameDay(value, date);
                const isToday = sameDay(today, date);

                return (
                  <View key={day} style={styles.calendarCell}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={displayDate(date)}
                      accessibilityState={{ selected }}
                      onPress={() => chooseDay(day)}
                      style={[
                        styles.dayButton,
                        selected
                          ? { backgroundColor: theme.primary }
                          : isToday
                            ? { borderColor: theme.primary, borderWidth: 1 }
                            : undefined,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          { color: selected ? '#ffffff' : theme.foreground },
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={() => setIsOpen(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.foreground }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function TimePickerField({
  value,
  onChange,
  accessibilityLabel,
}: TimePickerFieldProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [isOpen, setIsOpen] = useState(false);
  const [draftHour, setDraftHour] = useState('00');
  const [draftMinute, setDraftMinute] = useState('00');
  const [activePart, setActivePart] = useState<TimePart>('hour');
  const [displayHour, displayMinute] = parseTime(value);
  const options = activePart === 'hour' ? HOUR_OPTIONS : MINUTE_OPTIONS;
  const selectedOption = activePart === 'hour' ? draftHour : draftMinute;

  const openPicker = (part: TimePart) => {
    Keyboard.dismiss();
    const [hour, minute] = parseTime(value);
    setDraftHour(hour);
    setDraftMinute(minute);
    setActivePart(part);
    setIsOpen(true);
  };

  return (
    <>
      <View
        style={[
          styles.timeFieldButton,
          { borderColor: theme.border, backgroundColor: theme.card },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel}, horas`}
          onPress={() => openPicker('hour')}
          style={[
            styles.timeFieldSegment,
            { backgroundColor: theme.muted, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.timeFieldSegmentText, { color: theme.foreground }]}>
            {displayHour}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.timeColon, { color: theme.mutedForeground }]}>:</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel}, minutos`}
          onPress={() => openPicker('minute')}
          style={[
            styles.timeFieldSegment,
            { backgroundColor: theme.muted, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.timeFieldSegmentText, { color: theme.foreground }]}>
            {displayMinute}
          </Text>
        </TouchableOpacity>
        <View style={styles.timeFieldSpacer} />
        <Ionicons name="chevron-down" size={16} color={theme.mutedForeground} />
      </View>

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar horários"
            onPress={() => setIsOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.sheet, { backgroundColor: theme.card }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.foreground }]}>
                  Selecionar horário
                </Text>
                <Text style={[styles.sheetSubtitle, { color: theme.mutedForeground }]}>
                  Escolha horas e minutos
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fechar seletor de horário"
                onPress={() => setIsOpen(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color={theme.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.timeSegmentTabs}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Selecionar hora, ${draftHour}`}
                accessibilityState={{ selected: activePart === 'hour' }}
                onPress={() => setActivePart('hour')}
                style={[
                  styles.timeSegmentTab,
                  {
                    borderColor: activePart === 'hour' ? theme.primary : theme.border,
                    backgroundColor: activePart === 'hour' ? `${theme.primary}18` : theme.card,
                  },
                ]}
              >
                <Text style={[styles.timeSegmentTabLabel, { color: theme.mutedForeground }]}>
                  Hora
                </Text>
                <Text style={[styles.timeSegmentTabValue, { color: theme.foreground }]}>
                  {draftHour}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Selecionar minuto, ${draftMinute}`}
                accessibilityState={{ selected: activePart === 'minute' }}
                onPress={() => setActivePart('minute')}
                style={[
                  styles.timeSegmentTab,
                  {
                    borderColor: activePart === 'minute' ? theme.primary : theme.border,
                    backgroundColor: activePart === 'minute' ? `${theme.primary}18` : theme.card,
                  },
                ]}
              >
                <Text style={[styles.timeSegmentTabLabel, { color: theme.mutedForeground }]}>
                  Minuto
                </Text>
                <Text style={[styles.timeSegmentTabValue, { color: theme.foreground }]}>
                  {draftMinute}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.timeScrollLabel, { color: theme.mutedForeground }]}>
              {activePart === 'hour' ? 'Horas · 00–23' : 'Minutos · 00–59'}
            </Text>
            <FlatList
              key={activePart}
              data={options}
              keyExtractor={(item) => item}
              initialScrollIndex={Number(selectedOption)}
              getItemLayout={(_, index) => ({
                length: TIME_ROW_HEIGHT,
                offset: TIME_ROW_HEIGHT * index,
                index,
              })}
              style={styles.timeOptionsScroll}
              contentContainerStyle={styles.timeOptionsList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              renderItem={({ item }) => {
                const selected = selectedOption === item;
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={activePart === 'hour' ? `${item} horas` : `${item} minutos`}
                    accessibilityState={{ selected }}
                    onPress={() => activePart === 'hour' ? setDraftHour(item) : setDraftMinute(item)}
                    style={[
                      styles.timeOption,
                      {
                        backgroundColor: selected ? theme.primary : 'transparent',
                        borderBottomColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeOptionText,
                        { color: selected ? theme.primaryForeground : theme.foreground },
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={styles.timePickerActions}>
              <TouchableOpacity
                style={[styles.timeActionButton, { borderColor: theme.border }]}
                onPress={() => setIsOpen(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.foreground }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.timeActionButton,
                  { borderColor: theme.primary, backgroundColor: theme.primary },
                ]}
                onPress={() => {
                  onChange(`${draftHour}:${draftMinute}`);
                  setIsOpen(false);
                }}
              >
                <Text style={[styles.cancelButtonText, { color: theme.primaryForeground }]}>
                  Aplicar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fieldButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 9,
    height: 48,
    paddingHorizontal: 12,
  },
  fieldText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
  },
  modalOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    alignSelf: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    padding: 20,
    width: '100%',
    maxWidth: 480,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sheetTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 19,
  },
  sheetSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    marginTop: 3,
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthArrow: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  monthLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    textTransform: 'capitalize',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  calendarCell: {
    alignItems: 'center',
    flexBasis: '14.2857%',
    height: 44,
    justifyContent: 'center',
  },
  weekday: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
  },
  dayButton: {
    alignItems: 'center',
    borderRadius: 22,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  dayText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
  },
  cancelButton: {
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
  },
  timeFieldButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    height: 48,
    paddingHorizontal: 10,
  },
  timeFieldSegment: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    minWidth: 42,
    paddingHorizontal: 8,
  },
  timeFieldSegmentText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
  },
  timeColon: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
  },
  timeFieldSpacer: {
    flex: 1,
  },
  timeSegmentTabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  timeSegmentTab: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 9,
  },
  timeSegmentTabLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
  },
  timeSegmentTabValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    marginTop: 2,
  },
  timeScrollLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    marginBottom: 6,
  },
  timeOptionsScroll: {
    maxHeight: 288,
  },
  timeOptionsList: {
    paddingBottom: 6,
  },
  timeOption: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 7,
    height: TIME_ROW_HEIGHT - 2,
    justifyContent: 'center',
    marginVertical: 1,
  },
  timeOptionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
  },
  timePickerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  timeActionButton: {
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    height: 46,
    justifyContent: 'center',
  },
});