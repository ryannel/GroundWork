"""Read compiler descriptors only; never import or execute repository code."""
import json
import sys
from pathlib import Path
from google.protobuf import descriptor_pb2

request = json.loads(sys.argv[1])
sets = descriptor_pb2.FileDescriptorSet.FromString(Path(request['descriptor']).read_bytes())
file = next(item for item in sets.file if item.name == request['path'])
locations = {tuple(item.path): list(item.span) for item in file.source_code_info.location}
unsupported = ['Options other than map_entry, extension declarations and edition features are retained in descriptor bytes but are not interpreted.']
prefix = request['repo'] + ':' + request['path'] + '#'


def anchor(path):
    span = locations.get(tuple(path))
    if span is None:
        unsupported.append('No explicit source declaration for descriptor path ' + str(path))
        return None
    end_line, end_column = (span[0], span[2]) if len(span) == 3 else (span[2], span[3])
    return dict(path=request['path'], sha256=request['sha256'], lines=[span[0] + 1, end_line + 1],
                columns=[span[1], end_column], descriptor_path=path)


def ranges(values, path, semantics):
    return [dict(start=v.start, end=v.end, end_semantics=semantics, anchor=anchor(path + [i]))
            for i, v in enumerate(values)]


def names(values, path):
    return [dict(name=v, anchor=anchor(path + [i])) for i, v in enumerate(values)]


def enum(value, path, parent):
    fq = parent + '.' + value.name
    return dict(id=prefix+fq, fq_name=fq, anchor=anchor(path),
                values=[dict(id=prefix+fq+'.'+v.name, name=v.name, number=v.number,
                             anchor=anchor(path+[2, i])) for i, v in enumerate(value.value)],
                reserved_ranges=ranges(value.reserved_range, path+[4], 'inclusive'),
                reserved_names=names(value.reserved_name, path+[5]))


def field(value, path, message_value, fq):
    map_message = next((n for n in message_value.nested_type
                        if n.options.map_entry and value.type_name == fq+'.'+n.name), None)
    map_type = None
    if map_message:
        key, val = map_message.field
        map_type = dict(key_type=descriptor_pb2.FieldDescriptorProto.Type.Name(key.type),
                        value_type=descriptor_pb2.FieldDescriptorProto.Type.Name(val.type),
                        value_type_name=val.type_name)
    oneof = message_value.oneof_decl[value.oneof_index].name if value.HasField('oneof_index') else None
    return dict(id=prefix+fq+'.'+value.name, name=value.name, number=value.number,
                type=descriptor_pb2.FieldDescriptorProto.Type.Name(value.type), type_name=value.type_name,
                label=descriptor_pb2.FieldDescriptorProto.Label.Name(value.label),
                repeated=value.label == descriptor_pb2.FieldDescriptorProto.LABEL_REPEATED,
                map=map_type, oneof=oneof, proto3_optional=value.proto3_optional,
                json_name=value.json_name, default_value=value.default_value,
                has_default_value=value.HasField('default_value'), anchor=anchor(path))


def oneof(value, path, message_value, fq, index):
    members = [v for v in message_value.field if v.HasField('oneof_index') and v.oneof_index == index]
    return dict(id=prefix+fq+'.'+value.name, name=value.name,
                synthetic=len(members) == 1 and members[0].proto3_optional,
                field_ids=[prefix+fq+'.'+v.name for v in members], anchor=anchor(path))


def message(value, path, parent):
    fq = parent + '.' + value.name
    return dict(id=prefix+fq, fq_name=fq, map_entry=value.options.map_entry, anchor=anchor(path),
                fields=[field(v, path+[2, i], value, fq) for i, v in enumerate(value.field)],
                nested_messages=[message(v, path+[3, i], fq) for i, v in enumerate(value.nested_type)],
                enums=[enum(v, path+[4, i], fq) for i, v in enumerate(value.enum_type)],
                oneofs=[oneof(v, path+[8, i], value, fq, i) for i, v in enumerate(value.oneof_decl)],
                reserved_ranges=ranges(value.reserved_range, path+[9], 'exclusive'),
                reserved_names=names(value.reserved_name, path+[10]),
                extension_ranges=ranges(value.extension_range, path+[5], 'exclusive'))


def service(value, path, parent):
    fq = parent + '.' + value.name
    return dict(id=prefix+fq, fq_name=fq, anchor=anchor(path), methods=[
        dict(id=prefix+fq+'.'+v.name, name=v.name, input_type=v.input_type, output_type=v.output_type,
             client_streaming=v.client_streaming, server_streaming=v.server_streaming,
             anchor=anchor(path+[2, i])) for i, v in enumerate(value.method)])


root = '.' + file.package if file.package else ''
result = dict(package=file.package, syntax=file.syntax or 'proto2', imports=[
    dict(path=v, public=i in file.public_dependency, weak=i in file.weak_dependency,
         anchor=anchor([3, i])) for i, v in enumerate(file.dependency)],
    messages=[message(v, [4, i], root) for i, v in enumerate(file.message_type)],
    enums=[enum(v, [5, i], root) for i, v in enumerate(file.enum_type)],
    services=[service(v, [6, i], root) for i, v in enumerate(file.service)], unsupported=unsupported)
print(json.dumps(dict(file=result, dependencies=[v.name for v in sets.file])))
