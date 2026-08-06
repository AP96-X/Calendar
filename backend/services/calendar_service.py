# -*- coding: utf-8 -*-
"""农历节假日节气服务 - 对外统一入口（性能优化版）"""

import calendar as cal_mod
from datetime import date, datetime
from ..database import get_db
from .lunar import get_lunar_info
from .holiday import get_holiday_info
from .solar_term import get_solar_term_for_date, get_solar_terms_for_year


def compute_calendar_meta_for_month(year, month):
    """计算一个月日历元数据并批量写入 DB（使用 executemany）"""
    total_days = cal_mod.monthrange(year, month)[1]
    db = get_db()
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # 预缓存全年节气（避免循环内逐日 DB 查询）
    _ = get_solar_terms_for_year(year)
    if month <= 2:
        _ = get_solar_terms_for_year(year - 1)

    values = []
    for day in range(1, total_days + 1):
        g_date = date(year, month, day)
        date_str = g_date.strftime('%Y-%m-%d')
        lunar_text = get_lunar_info(g_date)

        # 一次调用获取全部节假日信息（替代原来的 4 次独立调用）
        holiday_name, is_hol, is_wd, adjust_for = get_holiday_info(g_date)

        solar_term = get_solar_term_for_date(g_date)
        is_weekend = g_date.weekday() >= 5
        is_adjust_work = is_weekend and is_wd

        values.append((date_str, lunar_text, holiday_name, solar_term,
                       int(is_hol), int(is_wd), int(is_weekend), int(is_adjust_work),
                       adjust_for, now_str))

    # 批量写入（31 条 → 1 次 INSERT）
    db.executemany('''INSERT OR REPLACE INTO calendar_meta
        (date, lunar, holiday, solar_term, is_holiday, is_workday,
         is_weekend, is_adjust_work, adjust_for, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', values)
    db.commit()

    # 直接返回结果（避免写完又立刻查 DB）
    result = {}
    for vals in values:
        result[vals[0]] = {
            'lunar': vals[1], 'holiday': vals[2], 'solar_term': vals[3],
            'is_holiday': bool(vals[4]), 'is_workday': bool(vals[5]),
            'is_weekend': bool(vals[6]), 'is_adjust_work': bool(vals[7]),
            'adjust_for': vals[8],
        }
    return total_days, result


def get_calendar_meta_from_db(year, month):
    """从 DB 读取日历元数据（范围查询优化）"""
    db = get_db()
    prefix = f"{year:04d}-{month:02d}"
    total_days = cal_mod.monthrange(year, month)[1]
    start_date = f"{prefix}-01"
    end_date = f"{prefix}-{total_days:02d}"

    # 使用范围查询代替 LIKE（更好的索引利用）
    rows = db.execute(
        'SELECT * FROM calendar_meta WHERE date >= ? AND date <= ? ORDER BY date',
        (start_date, end_date)).fetchall()

    has_solar_term = False
    result = {}
    max_updated = ''
    for r in rows:
        st = r['solar_term']
        if st:
            has_solar_term = True
        result[r['date']] = {
            'lunar': r['lunar'], 'holiday': r['holiday'], 'solar_term': st,
            'is_holiday': bool(r['is_holiday']), 'is_workday': bool(r['is_workday']),
            'is_weekend': bool(r['is_weekend']), 'is_adjust_work': bool(r['is_adjust_work']),
            'adjust_for': r['adjust_for'],
        }
        ut = r['updated_at']
        if ut:
            ut_str = ut if isinstance(ut, str) else ut.strftime('%Y-%m-%d %H:%M:%S')
            if ut_str > max_updated:
                max_updated = ut_str

    is_complete = len(result) >= total_days and has_solar_term
    return result, is_complete, max_updated
