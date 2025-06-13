import React from 'react';
import { useState, useEffect } from 'react';
import Select from '@atlaskit/select';
import { DatePicker } from '@atlaskit/datetime-picker';
import { format, eachDayOfInterval, parse } from 'date-fns';

export const SCHEDULE_TYPES = {
  FULL_DAY: { id: 'FULL_DAY', label: 'Full Day' },
  HALF_DAY_MORNING: { id: 'HALF_DAY_MORNING', label: 'Half Day - Morning' },
  HALF_DAY_AFTERNOON: { id: 'HALF_DAY_AFTERNOON', label: 'Half Day - Afternoon' }
};

const DailySchedule = ({ startDate, endDate, onChange }) => {
  const [schedules, setSchedules] = useState([]);

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      const days = eachDayOfInterval({ start, end });
      
      const initialSchedules = days.map(day => {
        const existingSchedule = value?.find(v => v.date === format(day, 'yyyy-MM-dd'));
        return existingSchedule || {
          date: format(day, 'yyyy-MM-dd'),
          type: SCHEDULE_TYPES.FULL_DAY.id
        };
      });

      setSchedules(initialSchedules);
      onChange(initialSchedules);
    }
  }, [startDate, endDate]);



  const getScheduleTypeOptions = () => [
    { label: SCHEDULE_TYPES.FULL_DAY.label, value: SCHEDULE_TYPES.FULL_DAY.id },
    { label: SCHEDULE_TYPES.HALF_DAY_MORNING.label, value: SCHEDULE_TYPES.HALF_DAY_MORNING.id },
    { label: SCHEDULE_TYPES.HALF_DAY_AFTERNOON.label, value: SCHEDULE_TYPES.HALF_DAY_AFTERNOON.id }
  ];

  return (
    <div className="daily-schedule-selector">
      <div className="schedule-header">
        <h4>Daily Schedule</h4>
        <p className="schedule-hint">Customize your schedule for each day</p>
      </div>
      
      <div className="schedule-grid">
        {schedules.map((schedule) => (
          <div key={schedule.date} className="schedule-day">
            <div className="day-header">
              <span className="day-date">
                {format(new Date(schedule.date), 'EEE, MMM d')}
              </span>
            </div>
            <div className="day-selector">
              <Select
                classNamePrefix="schedule-select"
                options={getScheduleTypeOptions()}
                value={getScheduleTypeOptions().find(opt => opt.value === schedule.type)}
                onChange={(selected) => handleScheduleChange(schedule.date, selected.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailyScheduleSelector;