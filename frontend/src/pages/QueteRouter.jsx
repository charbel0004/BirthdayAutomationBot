import { AdminQuetePage, MemberQuetePage } from './quete';

export default function QueteRouter(props) {
  if (props.canManage) {
    return <AdminQuetePage {...props} />;
  }

  return <MemberQuetePage {...props} />;
}
